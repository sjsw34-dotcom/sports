"""이미지 기반 기출 PDF → OCR로 텍스트 추출.

2단 레이아웃 유지 (왼쪽 → 오른쪽). EasyOCR(ko) 사용.
출력 포맷은 extract_exam_pdf.py와 동일해 parse_exam_text.py가 바로 처리 가능.
"""
from __future__ import annotations

import argparse
import sys

import cv2
import easyocr
import fitz
import numpy as np


def render(pg: fitz.Page, dpi: int) -> np.ndarray:
    pix = pg.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, pix.n
    )
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
    return img


def ocr_column(
    reader: easyocr.Reader, img: np.ndarray
) -> str:
    results = reader.readtext(img, detail=1, paragraph=False)
    # y 정렬, 같은 줄 단위로 그룹
    items = [(sum(p[1] for p in b) / 4, sum(p[0] for p in b) / 4, t) for b, t, _ in results]
    items.sort(key=lambda x: (round(x[0] / 18), x[1]))
    # 줄 재구성
    lines: list[list[str]] = []
    last_y: float | None = None
    for y, x, t in items:
        if last_y is None or abs(y - last_y) > 18:
            lines.append([t])
            last_y = y
        else:
            lines[-1].append(t)
    return "\n".join(" ".join(parts) for parts in lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--split", type=float, default=0.5, help="2단 분리 비율 (0~1)")
    ap.add_argument("--single-column", action="store_true")
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    print("loading EasyOCR...", file=sys.stderr)
    reader = easyocr.Reader(["ko", "en"], gpu=False, verbose=False)

    doc = fitz.open(args.pdf)
    parts: list[str] = []
    for i, pg in enumerate(doc):
        img = render(pg, args.dpi)
        h, w = img.shape[:2]
        if args.single_column:
            text = ocr_column(reader, img)
            parts.append(f"\n\n[[PAGE {i + 1}]]\n" + text)
        else:
            mid = int(w * args.split)
            left = img[:, :mid]
            right = img[:, mid:]
            lt = ocr_column(reader, left)
            rt = ocr_column(reader, right)
            parts.append(f"\n\n[[PAGE {i + 1}]]\n" + lt + "\n\n" + rt)
        print(f"  page {i+1}/{len(doc)} done", file=sys.stderr)

    text = "\n".join(parts).strip()
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {args.output} ({len(text)} chars)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
