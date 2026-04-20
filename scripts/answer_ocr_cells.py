"""정답가안 PDF → 셀 단위 크롭 후 EasyOCR(숫자 전용) 로 ①~④ 분류.

핵심:
- 원(동그라미)은 OCR이 방해하므로 셀 중앙을 매우 타이트하게 크롭 (inner 50%)
- allowlist='1234' 로 4개 숫자만 인식
- 결과는 parse_answer_key.py 와 같은 포맷
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
    "sports-ethics": ["스포츠윤리"],
    "youth-pe": ["유아체육론"],
    "senior-pe": ["노인체육론"],
    "adapted-pe": ["특수체육론"],
}

CERT_PATTERNS = {
    "life-2": r"2급\s*생활",
    "pro-2": r"2급\s*전문",
    "disabled-2": r"2급\s*장애인",
    "youth": r"유소년",
    "senior": r"노인스포츠지도사",
    "life-1": r"1급\s*생활",
    "pro-1": r"1급\s*전문",
    "disabled-1": r"1급\s*장애인",
    "health": r"건강운동관리사",
}

FORM_RE = re.compile(r"([AB])형")


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


def find_grid(pg: fitz.Page, scale: float) -> tuple[list[float], list[float]]:
    hs: list[float] = []
    vs: list[float] = []
    for d in pg.get_drawings():
        for item in d["items"]:
            if item[0] == "l":
                p0, p1 = item[1], item[2]
                if abs(p0.y - p1.y) < 0.5 and abs(p1.x - p0.x) > 100:
                    hs.append(((p0.y + p1.y) / 2) * scale)
                elif abs(p0.x - p1.x) < 0.5 and abs(p1.y - p0.y) > 10:
                    vs.append(((p0.x + p1.x) / 2) * scale)
            elif item[0] == "re":
                r = item[1]
                if r.width > 100 and r.height < 1:
                    hs.append(r.y0 * scale)
                if r.height > 10 and r.width < 1:
                    vs.append(r.x0 * scale)
    return _cluster(hs, 6), _cluster(vs, 6)


def _cluster(vals: list[float], tol: float) -> list[float]:
    out: list[float] = []
    for v in sorted(vals):
        if not out or v - out[-1] > tol:
            out.append(v)
    return out


def ocr_labels(
    gray: np.ndarray, reader: easyocr.Reader
) -> tuple[dict[int, str], list[tuple[str, float]], list[tuple[str, float]]]:
    rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
    results = reader.readtext(rgb, detail=1, paragraph=False)
    subject_by_y: dict[float, str] = {}
    cert_labels: list[tuple[str, float]] = []  # (cert_id, y)
    form_labels: list[tuple[str, float]] = []  # ('A'/'B', y)
    for bbox, text, conf in results:
        cy = sum(p[1] for p in bbox) / 4
        t = re.sub(r"\s+", "", text)
        for sid, names in SUBJECT_NAMES.items():
            if t in [re.sub(r"\s+", "", n) for n in names]:
                subject_by_y[cy] = sid
                break
        for cid, pat in CERT_PATTERNS.items():
            if re.search(pat, text):
                cert_labels.append((cid, cy))
                break
        fm = FORM_RE.search(text)
        if fm and len(text.strip()) <= 3:
            form_labels.append((fm.group(1), cy))
    return subject_by_y, cert_labels, form_labels


def digit_from_cell(
    gray: np.ndarray,
    x0: float,
    x1: float,
    y0: float,
    y1: float,
    reader: easyocr.Reader,
) -> int | None:
    """셀을 타이트하게 크롭 → 원 안 숫자만 보이도록 → OCR (1~4)."""
    h, w = gray.shape
    px0 = max(0, int(x0))
    px1 = min(w, int(x1))
    py0 = max(0, int(y0))
    py1 = min(h, int(y1))
    cell = gray[py0:py1, px0:px1]
    ch, cw = cell.shape
    if ch < 10 or cw < 10:
        return None
    # 중앙 35% x 55% 크롭 (원 바깥 제거)
    mx = int(cw * 0.35)
    my = int(ch * 0.20)
    inner = cell[my : ch - my, mx : cw - mx]
    # 업스케일 + 이진화 (OCR 안정화)
    inner_up = cv2.resize(inner, (inner.shape[1] * 4, inner.shape[0] * 4))
    _, binimg = cv2.threshold(inner_up, 128, 255, cv2.THRESH_BINARY_INV)
    rgb = cv2.cvtColor(binimg, cv2.COLOR_GRAY2RGB)
    txt = reader.readtext(
        rgb, allowlist="1234", detail=0, paragraph=False, contrast_ths=0.1
    )
    digits = re.findall(r"[1-4]", "".join(txt))
    if not digits:
        return None
    return int(digits[0]) - 1


def cells_for_row(
    v_xs: list[float], y_top: float, y_bot: float
) -> list[tuple[float, float, float, float]]:
    candidates = v_xs[-21:]
    if len(candidates) < 21:
        raise RuntimeError(f"need 21 vertical lines, got {len(candidates)}")
    return [
        (candidates[i], candidates[i + 1], y_top, y_bot) for i in range(20)
    ]


def analyze_page(
    pg: fitz.Page, reader: easyocr.Reader, dpi: int
) -> tuple[str | None, dict[str, dict[str, list[int]]]]:
    gray, scale = render_page(pg, dpi)
    h_ys, v_xs = find_grid(pg, scale)
    subject_by_y, cert_labels, form_labels = ocr_labels(gray, reader)

    # 페이지 레벨 cert (첫 번째)
    cert_id: str | None = cert_labels[0][0] if cert_labels else None

    # 행 밴드
    bands = [
        (h_ys[i], h_ys[i + 1])
        for i in range(len(h_ys) - 1)
        if 40 < h_ys[i + 1] - h_ys[i] < 300
    ]
    band_mids = [(y0 + y1) / 2 for y0, y1 in bands]

    # band 별 과목 할당
    band_subject: dict[int, str] = {}
    for ycy, sid in subject_by_y.items():
        if not band_mids:
            continue
        bi = min(range(len(band_mids)), key=lambda i: abs(band_mids[i] - ycy))
        # 가장 가까운 band와 거리 체크
        if abs(band_mids[bi] - ycy) < 50:
            band_subject[bi] = sid

    # band 별 form (A/B) 할당: 각 band 위쪽에 가장 가까운 A/B 라벨
    def form_for_band(band_y: float) -> str | None:
        above = [(f, y) for f, y in form_labels if y < band_y]
        if not above:
            return None
        return max(above, key=lambda t: t[1])[0]

    # 출력: form → subject_id → answers
    out: dict[str, dict[str, list[int]]] = {"A": {}, "B": {}}
    for bi, (y0, y1) in enumerate(bands):
        sid = band_subject.get(bi)
        if not sid:
            continue
        form = form_for_band((y0 + y1) / 2)
        if form not in ("A", "B"):
            continue
        cells = cells_for_row(v_xs, y0, y1)
        answers: list[int] = []
        for x0, x1, cy0, cy1 in cells:
            v = digit_from_cell(gray, x0, x1, cy0, cy1, reader)
            answers.append(v if v is not None else -1)
        out[form][sid] = answers

    return cert_id, out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--dpi", type=int, default=450)
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    print("loading EasyOCR...", file=sys.stderr)
    reader = easyocr.Reader(["ko"], gpu=False, verbose=False)

    doc = fitz.open(args.pdf)
    all_certs: dict[str, dict[str, dict[str, dict[int, int]]]] = {}

    for i, pg in enumerate(doc):
        print(f"--- page {i+1} ---", file=sys.stderr)
        cert_id, forms = analyze_page(pg, reader, args.dpi)
        if not cert_id:
            print(f"  cert not detected, skipping", file=sys.stderr)
            continue
        all_certs.setdefault(cert_id, {})
        for form, subs in forms.items():
            if not subs:
                continue
            all_certs[cert_id].setdefault(form, {})
            for sid, answers in subs.items():
                if any(a < 0 for a in answers):
                    miss = [idx + 1 for idx, a in enumerate(answers) if a < 0]
                    print(
                        f"  WARN {cert_id}/{form}/{sid}: {len(miss)} cells missing {miss}",
                        file=sys.stderr,
                    )
                all_certs[cert_id][form][sid] = {
                    i + 1: a for i, a in enumerate(answers) if a >= 0
                }
                print(
                    f"  {cert_id}/{form}/{sid}: {''.join('①②③④'[a] if a >=0 else '?' for a in answers)}",
                    file=sys.stderr,
                )

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(all_certs, f, ensure_ascii=False, indent=2)
    print(f"wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
