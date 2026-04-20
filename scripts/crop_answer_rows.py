"""정답가안 PDF(벡터 아웃라인)의 각 과목 행을 자동 크롭.

접근:
1. PDF의 page drawings 에서 수평선/수직선을 추출해 테이블 격자 위치 계산
2. 행 간 수평선 사이를 행 경계로 하여 이미지 크롭
3. 결과 PNG는 한 행당 20개 셀이 또렷이 보이도록 저장
"""
from __future__ import annotations

import argparse
import os

import fitz
from PIL import Image


def find_horizontal_lines(page: fitz.Page) -> list[float]:
    """짧은 드로잉이 아닌 '실제 가로선' Y 좌표 반환."""
    lines: list[tuple[float, float, float]] = []  # (y, x0, x1)
    for d in page.get_drawings():
        for item in d["items"]:
            op = item[0]
            if op == "l":
                p0, p1 = item[1], item[2]
                if abs(p0.y - p1.y) < 0.5 and abs(p1.x - p0.x) > 200:
                    y = (p0.y + p1.y) / 2
                    lines.append((y, min(p0.x, p1.x), max(p0.x, p1.x)))
            elif op == "re":
                rect = item[1]
                w = rect.width
                if w > 200 and rect.height < 0.5:
                    lines.append((rect.y0, rect.x0, rect.x1))
    ys = sorted({round(y, 1) for y, _, _ in lines})
    # Cluster close Ys
    merged: list[float] = []
    for y in ys:
        if not merged or y - merged[-1] > 3:
            merged.append(y)
    return merged


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int, default=1, help="1-based")
    ap.add_argument("--dpi", type=int, default=450)
    ap.add_argument("--out-dir", default="scripts/out/pix")
    ap.add_argument("--tag", default="pX")
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    pg = doc[args.page - 1]

    pix = pg.get_pixmap(dpi=args.dpi)
    full_path = os.path.join(args.out_dir, f"{args.tag}_full.png")
    os.makedirs(args.out_dir, exist_ok=True)
    pix.save(full_path)

    img = Image.open(full_path)
    iw, ih = img.size

    # PDF 좌표 -> 이미지 픽셀 변환
    scale = pix.height / pg.rect.height  # y scale

    hlines = find_horizontal_lines(pg)
    print(f"page {args.page}: found {len(hlines)} horizontal lines")

    # 2020 포맷: A형 헤더 + 7행 + 간격 + B형 헤더 + 7행 = 대략 16개 수평선
    # 행은 인접한 수평선 쌍으로 정의. 여기서는 단순히 모든 선을 기준으로 구간 자름.
    cuts = [int(y * scale) for y in hlines]
    for i in range(len(cuts) - 1):
        y0, y1 = cuts[i], cuts[i + 1]
        if y1 - y0 < 30:
            continue  # 너무 좁은 구간은 스킵 (헤더 바로 아래 등)
        crop = img.crop((0, max(0, y0 - 5), iw, min(ih, y1 + 5)))
        crop.save(
            os.path.join(args.out_dir, f"{args.tag}_band_{i:02d}.png")
        )
    print(f"saved {len(cuts)-1} bands to {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
