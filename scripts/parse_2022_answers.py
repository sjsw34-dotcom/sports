"""2022 정답 PDF 파서 (텍스트 기반, 2급류 통합 포맷).

레이아웃 특징:
- 한 페이지에 A형 / B형 블록 연속 배치
- 과목명 공백 삽입 ("운 동 역 학") 또는 한 글자씩 분리 가능
- 답안 토큰에 복수정답 ("①,②,③,④" 등) → 첫 ① 사용
"""
from __future__ import annotations

import argparse
import json
import re
import sys

import fitz


CIRCLE_TO_INDEX = {"①": 0, "②": 1, "③": 2, "④": 3}
SUBJECT_NAMES = {
    "sports-sociology": "스포츠사회학",
    "sports-education": "스포츠교육학",
    "sports-psychology": "스포츠심리학",
    "korean-pe-history": "한국체육사",
    "exercise-physiology": "운동생리학",
    "exercise-mechanics": "운동역학",
    "sports-ethics": "스포츠윤리",
    "youth-pe": "유아체육론",
    "senior-pe": "노인체육론",
    "adapted-pe": "특수체육론",
}


def first_circle(s: str) -> int | None:
    for ch in s:
        if ch in CIRCLE_TO_INDEX:
            return CIRCLE_TO_INDEX[ch]
    return None


def parse_blocks(text: str) -> dict[str, dict[str, dict[int, int]]]:
    """전체 텍스트 → {form: {sid: {num: idx}}}. 여러 블록(A/B)을 순차 처리."""
    # 글자 합쳐진 토큰을 만들기 위해 공백 제거한 buffer 사용하는 대신,
    # 줄을 읽어가면서 과목명 후보(연속 한글) 누적.
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # 한글 한 글자씩 분리된 경우를 위해 "과목명 버퍼" 사용
    # 상태 머신: expect_header | in_subject | in_answers
    out: dict[str, dict[str, dict[int, int]]] = {}
    current_form: str | None = None

    # 과목명 후보 정규화 함수
    subject_by_compact = {
        re.sub(r"\s+", "", v): k for k, v in SUBJECT_NAMES.items()
    }

    i = 0
    while i < len(lines):
        ln = lines[i]
        fm = re.match(r"([AB])\s*형$", ln)
        if fm:
            current_form = fm.group(1)
            out.setdefault(current_form, {})
            i += 1
            continue

        if not current_form:
            i += 1
            continue

        # 과목명 매칭: 최대 6글자까지 이어붙이며 체크
        matched_sid: str | None = None
        matched_end = i
        buf = ""
        for k in range(i, min(i + 6, len(lines))):
            buf += lines[k]
            compact = re.sub(r"\s+", "", buf)
            if compact in subject_by_compact:
                matched_sid = subject_by_compact[compact]
                matched_end = k + 1
                break
            # 한 줄 자체가 이미 답안 기호면 중단
            if first_circle(lines[k]) is not None and len(compact) >= 1 and compact[-1] in CIRCLE_TO_INDEX:
                break

        if matched_sid:
            # 답안 20개 수집
            answers: dict[int, int] = {}
            j = matched_end
            num = 1
            while j < len(lines) and num <= 20:
                tok = lines[j]
                if re.fullmatch(r"\d+", tok):
                    j += 1
                    continue
                idx = first_circle(tok)
                if idx is not None:
                    answers[num] = idx
                    num += 1
                    j += 1
                else:
                    break
            if len(answers) == 20:
                out[current_form][matched_sid] = answers
                i = j
                continue

        i += 1

    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--cert", default="2geup-ryu")
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    doc = fitz.open(args.pdf)
    combined: dict[str, dict[str, dict[int, int]]] = {}
    for i, pg in enumerate(doc):
        blocks = parse_blocks(pg.get_text())
        for form, subs in blocks.items():
            combined.setdefault(form, {})
            for sid, ans in subs.items():
                if sid not in combined[form]:
                    combined[form][sid] = ans

    result = {args.cert: combined}
    for form, subs in combined.items():
        for sid, ans in subs.items():
            print(
                f"  {args.cert}/{form}/{sid}: {len(ans)}문항",
                file=sys.stderr,
            )

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
