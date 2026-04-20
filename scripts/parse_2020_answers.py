"""2020 정답가안 PDF → answers JSON (통합 파이프라인).

구조:
- 페이지당 1 자격증
- 페이지별 A(상단)/B(하단) 블록, 각 블록에 과목별 행 + 20셀
- 2급 생활/전문: 7 과목 (sociology + 6 공통 + ethics)
- 2급 장애인: 8 과목 (adapted-pe + 7 공통)
- 유소년: 8 과목 (youth-pe + 7 공통)
- 노인: 8 과목 (senior-pe + 7 공통)

처리:
1. PDF 드로잉에서 세로/가로선 → 셀 경계 격자
2. 각 과목 행 OCR 라벨로 확정, 누락된 행은 위치 순서로 추론
3. 각 셀 OCR (allowlist=1234) + ① 검출 실패시 `missing` 처리
4. missing 셀은 ①로 가정 (시각 검증: ①의 얇은 '1'은 원 안에서 OCR 미검출)
"""
from __future__ import annotations

import argparse
import json
import re
import sys

import cv2
import easyocr
import fitz
import numpy as np


SUBJECT_NAMES = {
    "sports-sociology": ["스포츠사회학"],
    "sports-education": ["스포츠교육학"],
    "sports-psychology": ["스포츠심리학"],
    "korean-pe-history": ["한국체육사"],
    "exercise-physiology": ["운동생리학"],
    "exercise-mechanics": ["운동역학"],
    "sports-ethics": ["스포츠윤리", "스포츠윤리론"],
    "youth-pe": ["유아체육론"],
    "senior-pe": ["노인체육론"],
    "adapted-pe": ["특수체육론"],
}

CERT_BY_PAGE = ["life-2", "pro-2", "disabled-2", "youth", "senior"]

# 각 자격증의 과목 순서 (위→아래)
SUBJ_ORDER = {
    "life-2": [
        "sports-sociology", "sports-education", "sports-psychology",
        "korean-pe-history", "exercise-physiology", "exercise-mechanics",
        "sports-ethics",
    ],
    "pro-2": [
        "sports-sociology", "sports-education", "sports-psychology",
        "korean-pe-history", "exercise-physiology", "exercise-mechanics",
        "sports-ethics",
    ],
    "disabled-2": [
        "adapted-pe", "sports-sociology", "sports-education",
        "sports-psychology", "korean-pe-history", "exercise-physiology",
        "exercise-mechanics", "sports-ethics",
    ],
    "youth": [
        "youth-pe", "sports-sociology", "sports-education",
        "sports-psychology", "korean-pe-history", "exercise-physiology",
        "exercise-mechanics", "sports-ethics",
    ],
    "senior": [
        "senior-pe", "sports-sociology", "sports-education",
        "sports-psychology", "korean-pe-history", "exercise-physiology",
        "exercise-mechanics", "sports-ethics",
    ],
}


def render_page(pg: fitz.Page, dpi: int) -> tuple[np.ndarray, float]:
    pix = pg.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, pix.n
    )
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    scale = pix.height / pg.rect.height
    return gray, scale


def find_v_lines(pg: fitz.Page, scale: float) -> list[float]:
    vs: list[float] = []
    for d in pg.get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                p0, p1 = it[1], it[2]
                if abs(p0.x - p1.x) < 0.5 and abs(p1.y - p0.y) > 10:
                    vs.append(((p0.x + p1.x) / 2) * scale)
            elif it[0] == "re":
                r = it[1]
                if r.height > 10 and r.width < 1:
                    vs.append(r.x0 * scale)
    out: list[float] = []
    for v in sorted(vs):
        if not out or v - out[-1] > 30:
            out.append(v)
    return out


def find_h_lines(pg: fitz.Page, scale: float) -> list[float]:
    hs: list[float] = []
    for d in pg.get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                p0, p1 = it[1], it[2]
                if abs(p0.y - p1.y) < 0.5 and abs(p1.x - p0.x) > 100:
                    hs.append(((p0.y + p1.y) / 2) * scale)
            elif it[0] == "re":
                r = it[1]
                if r.width > 100 and r.height < 1:
                    hs.append(r.y0 * scale)
    out: list[float] = []
    for v in sorted(hs):
        if not out or v - out[-1] > 6:
            out.append(v)
    return out


def pick_21_boundaries(v_xs: list[float]) -> list[float]:
    if len(v_xs) < 21:
        raise RuntimeError(f"need >=21 v-lines, got {len(v_xs)}")
    right = v_xs[-1]
    best: tuple[float, list[float]] | None = None
    for start in v_xs:
        span = right - start
        if span < 3000:
            continue
        w = span / 20
        if not (150 < w < 260):
            continue
        snapped: list[float] = []
        ok = True
        for i in range(21):
            target = start + i * w
            nearest = min(v_xs, key=lambda v: abs(v - target))
            if abs(nearest - target) > 30:
                ok = False
                break
            snapped.append(nearest)
        if not ok:
            continue
        uniq: list[float] = []
        for s in snapped:
            if not uniq or abs(s - uniq[-1]) > 50:
                uniq.append(s)
        if len(uniq) != 21:
            continue
        diffs = [uniq[i + 1] - uniq[i] for i in range(20)]
        score = float(np.std(diffs))
        if best is None or score < best[0]:
            best = (score, uniq)
    if best is None:
        raise RuntimeError("failed to infer 21 cell boundaries")
    return best[1]


def resolve_bands(h_ys: list[float]) -> list[tuple[float, float]]:
    return [
        (h_ys[i], h_ys[i + 1])
        for i in range(len(h_ys) - 1)
        if 40 < h_ys[i + 1] - h_ys[i] < 350
    ]


def assign_block_bands(
    bands: list[tuple[float, float]],
    page_mid: float,
    subj_order: list[str],
) -> dict[str, tuple[str, float, float]]:
    """블록(A/B)별로 subj_order에 해당하는 정확한 수의 row를 고른다.

    과목 수 == 각 블록 예상 row 수. 밴드 중 유효 row만 골라 할당.
    반환: {form: [(subject_id, y0, y1), ...]}
    """
    upper = [(y0, y1) for y0, y1 in bands if (y0 + y1) / 2 < page_mid]
    lower = [(y0, y1) for y0, y1 in bands if (y0 + y1) / 2 >= page_mid]
    return upper, lower


def find_row_bands(
    bands: list[tuple[float, float]], n_expected: int
) -> list[tuple[float, float]]:
    """블록 내 밴드 중 실제 과목 행만 걸러내 순서대로 n_expected개 반환.

    전략:
    - 높이 150~170 (정상 row) 또는 290~310 (sociology 변칙) 만 통과
    - 높이 130 (컬럼 헤더) 또는 260~275 (블록 사이 간격) 는 제외
    - 상위 n_expected개 반환 (y 오름차순)
    """
    cand = []
    for y0, y1 in bands:
        h = y1 - y0
        if 140 < h < 180 or 285 < h < 320:
            cand.append((y0, y1))
    cand.sort(key=lambda p: p[0])
    if len(cand) >= n_expected:
        return cand[:n_expected]
    return cand


def digit_from_cell(
    gray: np.ndarray,
    x0: float, x1: float, y0: float, y1: float,
    reader: easyocr.Reader,
) -> int | None:
    h, w = gray.shape
    px0 = max(0, int(x0)); px1 = min(w, int(x1))
    py0 = max(0, int(y0)); py1 = min(h, int(y1))
    cell = gray[py0:py1, px0:px1]
    ch, cw = cell.shape
    if ch < 10 or cw < 10:
        return None
    # 행 높이가 300+인 경우 (sociology 변칙) 하단 절반만 사용
    if ch > 230:
        cell = cell[ch // 2 :, :]
        ch = cell.shape[0]
    mx = int(cw * 0.22)
    my = int(ch * 0.12)
    inner = cell[my : ch - my, mx : cw - mx]
    inner_up = cv2.resize(inner, (inner.shape[1] * 4, inner.shape[0] * 4))
    for thresh_mode in ("otsu", "fixed", "adaptive"):
        if thresh_mode == "otsu":
            _, binimg = cv2.threshold(
                inner_up, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
            )
        elif thresh_mode == "fixed":
            _, binimg = cv2.threshold(inner_up, 140, 255, cv2.THRESH_BINARY_INV)
        else:
            binimg = cv2.adaptiveThreshold(
                inner_up, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY_INV, 31, 10,
            )
        rgb = cv2.cvtColor(binimg, cv2.COLOR_GRAY2RGB)
        txt = reader.readtext(
            rgb, allowlist="1234", detail=0, paragraph=False, contrast_ths=0.1
        )
        digits = re.findall(r"[1-4]", "".join(txt))
        if digits:
            return int(digits[0]) - 1
    return None


def analyze_page(
    pg: fitz.Page, pidx: int, reader: easyocr.Reader, dpi: int
) -> tuple[str, dict[str, dict[str, list[int]]]]:
    cert_id = CERT_BY_PAGE[pidx]
    subj_order = SUBJ_ORDER[cert_id]
    n_expected = len(subj_order)

    gray, scale = render_page(pg, dpi)
    v_xs = find_v_lines(pg, scale)
    h_ys = find_h_lines(pg, scale)
    bounds = pick_21_boundaries(v_xs)
    bands = resolve_bands(h_ys)
    page_mid = gray.shape[0] / 2

    upper_bands = [b for b in bands if (b[0] + b[1]) / 2 < page_mid]
    lower_bands = [b for b in bands if (b[0] + b[1]) / 2 >= page_mid]
    upper_rows = find_row_bands(upper_bands, n_expected)
    lower_rows = find_row_bands(lower_bands, n_expected)

    if len(upper_rows) != n_expected or len(lower_rows) != n_expected:
        print(
            f"  WARN {cert_id}: rows upper={len(upper_rows)}, lower={len(lower_rows)}, expected={n_expected}",
            file=sys.stderr,
        )

    out: dict[str, dict[str, list[int]]] = {"A": {}, "B": {}}
    missing_count = 0
    for form, rows in (("A", upper_rows), ("B", lower_rows)):
        for i, (y0, y1) in enumerate(rows):
            if i >= len(subj_order):
                break
            sid = subj_order[i]
            answers: list[int] = []
            for ci in range(20):
                x0, x1 = bounds[ci], bounds[ci + 1]
                v = digit_from_cell(gray, x0, x1, y0, y1, reader)
                if v is None:
                    # ① 로 가정 (OCR이 얇은 '1'을 못 잡음)
                    answers.append(0)
                    missing_count += 1
                else:
                    answers.append(v)
            out[form][sid] = answers
    print(f"  {cert_id}: inferred ①={missing_count} cells", file=sys.stderr)
    return cert_id, out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--dpi", type=int, default=450)
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    print("loading EasyOCR...", file=sys.stderr)
    reader = easyocr.Reader(["ko"], gpu=False, verbose=False)

    doc = fitz.open(args.pdf)
    all_certs: dict[str, dict[str, dict[str, dict[int, int]]]] = {}

    for pidx, pg in enumerate(doc):
        print(f"--- page {pidx+1} ---", file=sys.stderr)
        cert_id, forms = analyze_page(pg, pidx, reader, args.dpi)
        all_certs.setdefault(cert_id, {})
        for form, subs in forms.items():
            all_certs[cert_id].setdefault(form, {})
            for sid, answers in subs.items():
                all_certs[cert_id][form][sid] = {
                    i + 1: a for i, a in enumerate(answers)
                }
                disp = "".join("①②③④"[a] for a in answers)
                print(f"  {cert_id}/{form}/{sid}: {disp}", file=sys.stderr)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(all_certs, f, ensure_ascii=False, indent=2)
    print(f"wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
