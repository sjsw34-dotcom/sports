"""기출 PDF 텍스트 추출기.

2단 레이아웃 PDF를 왼쪽 컬럼 → 오른쪽 컬럼 순으로 읽어 한 줄로 이어 붙인다.
스캔 PDF는 지원하지 않음 (OCR 필요).
"""
from __future__ import annotations

import argparse
import sys
import pdfplumber


def extract_two_column(path: str, split_ratio: float = 0.5) -> str:
    parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            w, h = page.width, page.height
            mid = w * split_ratio
            left = page.within_bbox((0, 0, mid, h))
            right = page.within_bbox((mid, 0, w, h))
            lt = (left.extract_text() or "").strip()
            rt = (right.extract_text() or "").strip()
            if not lt and not rt:
                # fallback to whole page (single column)
                whole = (page.extract_text() or "").strip()
                if whole:
                    parts.append(f"\n\n[[PAGE {i + 1}]]\n" + whole)
                continue
            parts.append(f"\n\n[[PAGE {i + 1}]]\n" + lt + "\n\n" + rt)
    return "\n".join(parts).strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--split", type=float, default=0.5)
    ap.add_argument("-o", "--output")
    args = ap.parse_args()

    text = extract_two_column(args.pdf, args.split)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {args.output} ({len(text)} chars)", file=sys.stderr)
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
