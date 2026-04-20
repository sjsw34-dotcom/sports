"""벡터 아웃라인 정답가안 PDF → 템플릿 매칭으로 ①②③④ 자동 분류.

파이프라인:
1. PDF 페이지를 고해상도 PNG 렌더
2. PDF drawings 로부터 가로선·세로선 좌표 → 테이블 셀 경계
3. 각 셀에서 중앙부 크롭 → ①②③④ 템플릿과 NCC 비교로 라벨링
4. 과목명 행은 EasyOCR 한 번으로 파악 (이미 정상 작동)

출력: { cert: { form: { subject_id: {num: idx} } } } (parse_answer_key.py와 같은 포맷)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass

import cv2
import fitz
import numpy as np
from PIL import Image


CIRCLE_TO_INDEX = {"①": 0, "②": 1, "③": 2, "④": 3}
INDEX_TO_CIRCLE = ["①", "②", "③", "④"]

SUBJECT_NAMES = {
    "sports-sociology": ["스포츠사회학"],
    "sports-education": ["스포츠교육학"],
    "sports-psychology": ["스포츠심리학"],
    "korean-pe-history": ["한국체육사", "한 국 체 육 사"],
    "exercise-physiology": ["운동생리학", "운 동 생 리 학"],
    "exercise-mechanics": ["운동역학", "운 동 역 학"],
    "sports-ethics": ["스포츠윤리", "스 포 츠 윤 리"],
    "youth-pe": ["유아체육론", "유 아 체 육 론"],
    "senior-pe": ["노인체육론", "노 인 체 육 론"],
    "adapted-pe": ["특수체육론", "특 수 체 육 론"],
}


@dataclass
class RowInfo:
    subject_id: str
    y_mid: float  # 이미지 픽셀 Y
    label: str


def render_page(pdf_path: str, page_idx: int, dpi: int) -> tuple[np.ndarray, fitz.Page, float]:
    doc = fitz.open(pdf_path)
    pg = doc[page_idx]
    pix = pg.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, pix.n
    )
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    scale = pix.height / pg.rect.height
    return gray, pg, scale


def find_grid_from_drawings(
    pg: fitz.Page, scale: float
) -> tuple[list[float], list[float]]:
    """(horizontal_ys, vertical_xs) 이미지 픽셀 좌표."""
    hs: list[float] = []
    vs: list[float] = []
    for d in pg.get_drawings():
        for item in d["items"]:
            op = item[0]
            if op == "l":
                p0, p1 = item[1], item[2]
                if abs(p0.y - p1.y) < 0.5 and abs(p1.x - p0.x) > 100:
                    hs.append(((p0.y + p1.y) / 2) * scale)
                elif abs(p0.x - p1.x) < 0.5 and abs(p1.y - p0.y) > 10:
                    vs.append(((p0.x + p1.x) / 2) * scale)
            elif op == "re":
                rect = item[1]
                if rect.width > 100 and rect.height < 1:
                    hs.append(rect.y0 * scale)
                if rect.height > 10 and rect.width < 1:
                    vs.append(rect.x0 * scale)
    return _cluster(hs, 6), _cluster(vs, 6)


def _cluster(values: list[float], tol: float) -> list[float]:
    vals = sorted(values)
    out: list[float] = []
    for v in vals:
        if not out or v - out[-1] > tol:
            out.append(v)
    return out


def read_subject_labels(
    gray: np.ndarray, h_ys: list[float]
) -> dict[float, str]:
    """각 행의 Y중심을 과목 id에 매핑. OCR 1회로 모든 과목 텍스트를 수집."""
    import easyocr

    reader = easyocr.Reader(["ko"], gpu=False, verbose=False)
    rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
    results = reader.readtext(rgb, detail=1, paragraph=False)

    labels: dict[float, str] = {}
    # 각 OCR 조각의 y중심을 가까운 h band에 할당
    for bbox, text, conf in results:
        cy = sum(p[1] for p in bbox) / 4
        # 한글 과목명만 고려
        t = re.sub(r"\s+", "", text)
        for sid, names in SUBJECT_NAMES.items():
            norm_names = [re.sub(r"\s+", "", n) for n in names]
            if t in norm_names:
                labels[cy] = sid
                break
    return labels


def extract_cell(
    gray: np.ndarray, x0: float, x1: float, y0: float, y1: float
) -> np.ndarray:
    h, w = gray.shape
    px0 = max(0, int(x0))
    px1 = min(w, int(x1))
    py0 = max(0, int(y0))
    py1 = min(h, int(y1))
    cell = gray[py0:py1, px0:px1]
    # 중앙부 40% 사각형으로 수축 (경계·패딩 제거)
    ch, cw = cell.shape
    mx = int(cw * 0.1)
    my = int(ch * 0.1)
    return cell[my : ch - my, mx : cw - mx]


def build_templates(
    gray: np.ndarray,
    cell_rects: list[tuple[int, float, float, float, float]],
    reference_row_values: list[int],
) -> list[np.ndarray]:
    """이미 라벨을 아는 한 행을 사용해 ①②③④ 템플릿 이미지 평균을 만든다.

    cell_rects: (col_idx, x0, x1, y0, y1)
    reference_row_values: 각 열의 정답 index (0~3)
    """
    samples: dict[int, list[np.ndarray]] = {0: [], 1: [], 2: [], 3: []}
    for (col_idx, x0, x1, y0, y1), v in zip(cell_rects, reference_row_values):
        cell = extract_cell(gray, x0, x1, y0, y1)
        samples[v].append(cell)
    # 각 라벨별 크기 통일 후 평균
    templates: list[np.ndarray] = []
    target_h, target_w = 64, 64
    for i in range(4):
        imgs = samples[i]
        if not imgs:
            raise RuntimeError(f"reference row missing label {i}")
        resized = [cv2.resize(im, (target_w, target_h)) for im in imgs]
        mean = np.mean(resized, axis=0).astype(np.uint8)
        templates.append(mean)
    return templates


def classify_cell(cell: np.ndarray, templates: list[np.ndarray]) -> int:
    h, w = templates[0].shape
    resized = cv2.resize(cell, (w, h))
    best_idx = 0
    best_score = -1e9
    for i, t in enumerate(templates):
        res = cv2.matchTemplate(resized, t, cv2.TM_CCOEFF_NORMED)
        score = float(res[0, 0])
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx


def column_cells_for_row(
    vs: list[float], y_top: float, y_bot: float, first_col_idx: int
) -> list[tuple[int, float, float, float, float]]:
    """행 Y 구간이 주어지면 (20개) 답변 셀 x범위를 반환."""
    out: list[tuple[int, float, float, float, float]] = []
    # 세로선 중 유효한 21개 (20 셀 경계) 를 heuristics로 고르기 힘드므로
    # 가장 뒤쪽 21개를 사용 (과목명 열 뒤의 20열 + 오른쪽 외곽선)
    candidate = vs[-21:]
    if len(candidate) < 21:
        raise RuntimeError(f"not enough vertical lines: {len(vs)}")
    for i in range(20):
        x0 = candidate[i]
        x1 = candidate[i + 1]
        out.append((first_col_idx + i, x0, x1, y_top, y_bot))
    return out


def analyze_page(
    pdf_path: str,
    page_idx: int,
    reference_hints: dict[str, list[int]],
    dpi: int = 450,
) -> list[tuple[str, int]]:
    """페이지의 모든 과목 행을 분류해 반환.

    reference_hints: {subject_id: [20개 정답 index]} — 한 행 이상 있어야 함 (템플릿 학습용)
    반환: [(subject_id, index), ...] 평탄화된 (per page) 정답 리스트는 별도 포맷으로.
    """
    raise NotImplementedError("orchestrator 는 runner 스크립트에서 구성")


def build_full_grid(
    pg: fitz.Page, scale: float
) -> tuple[list[float], list[float]]:
    h_ys, v_xs = find_grid_from_drawings(pg, scale)
    return h_ys, v_xs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int, default=1)
    ap.add_argument("--dpi", type=int, default=450)
    ap.add_argument("--ref-subject", required=True, help="템플릿 학습 기준 과목 id")
    ap.add_argument(
        "--ref-answers",
        required=True,
        help="기준 과목의 20정답(1-4) 문자열, 예: '21324...'",
    )
    ap.add_argument("-o", "--output", required=True)
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")

    gray, pg, scale = render_page(args.pdf, args.page - 1, args.dpi)
    h_ys, v_xs = find_grid_from_drawings(pg, scale)
    print(f"h_lines: {len(h_ys)}, v_lines: {len(v_xs)}", file=sys.stderr)

    # 과목 라벨 매핑
    labels = read_subject_labels(gray, h_ys)
    print(f"subjects found: {len(labels)}", file=sys.stderr)

    # 행 Y구간 리스트: 인접한 h_ys 쌍 중 높이가 유의미한 것만
    row_bands: list[tuple[float, float]] = []
    for i in range(len(h_ys) - 1):
        y0, y1 = h_ys[i], h_ys[i + 1]
        if 40 < y1 - y0 < 300:
            row_bands.append((y0, y1))

    # 각 행 중심 Y
    row_mids = [(y0 + y1) / 2 for y0, y1 in row_bands]

    # 라벨된 Y와 가장 가까운 row_band에 과목 할당
    row_to_subject: dict[int, str] = {}
    for ycy, sid in labels.items():
        # 가장 가까운 band index
        best = min(range(len(row_bands)), key=lambda i: abs(row_mids[i] - ycy))
        row_to_subject[best] = sid

    # 기준 과목 행 찾기
    ref_idx: int | None = None
    for bi, sid in row_to_subject.items():
        if sid == args.ref_subject:
            ref_idx = bi
            break
    if ref_idx is None:
        raise SystemExit(f"reference subject {args.ref_subject} not found on this page")

    # 기준 행으로 템플릿 만들기
    ref_values = [int(c) - 1 for c in args.ref_answers.strip() if c in "1234"]
    if len(ref_values) != 20:
        raise SystemExit("ref-answers must have 20 digits 1-4")
    y_top, y_bot = row_bands[ref_idx]
    cell_rects = column_cells_for_row(v_xs, y_top, y_bot, first_col_idx=0)
    templates = build_templates(gray, cell_rects, ref_values)

    # 모든 행 분류
    result: dict[str, list[int]] = {}
    for bi, (y0, y1) in enumerate(row_bands):
        sid = row_to_subject.get(bi)
        if not sid:
            continue
        cells = column_cells_for_row(v_xs, y0, y1, first_col_idx=0)
        classified = [
            classify_cell(extract_cell(gray, x0, x1, cy0, cy1), templates)
            for (_, x0, x1, cy0, cy1) in cells
        ]
        result[sid] = classified

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"wrote {args.output}", file=sys.stderr)
    for sid, ans in result.items():
        print(f"{sid}: {''.join(INDEX_TO_CIRCLE[i] for i in ans)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
