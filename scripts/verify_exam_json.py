"""최종 JSON이 정답가안 PDF 원문과 일치하는지 재검증.

parse_answer_key.py 와 독립적으로 PDF를 직접 읽어 동그라미 문자 배열을 뽑는다.
이를 data/questions/<subject>/<tag>.json 의 answer 와 비교한다.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

import pdfplumber


CIRCLE_TO_INDEX = {"①": 0, "②": 1, "③": 2, "④": 3}

SUBJECT_ALIAS = {
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

CERT_PATTERNS = {
    "life-2": r"2급 생활스포츠지도사",
    "pro-2": r"2급 전문스포츠지도사",
    "disabled-2": r"2급 장애인스포츠지도사",
    "youth": r"유소년스포츠지도사",
    "senior": r"노인스포츠지도사",
    "life-1": r"1급 생활스포츠지도사",
    "pro-1": r"1급 전문스포츠지도사",
    "disabled-1": r"1급 장애인스포츠지도사",
    "health": r"건강운동관리사",
}


def extract_answer_line(
    pdf_path: str, cert: str, form: str, subject_id: str
) -> list[int]:
    """PDF에서 (자격증, 형, 과목) 정답 20개 인덱스 반환."""
    with pdfplumber.open(pdf_path) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)

    cert_pat = CERT_PATTERNS.get(cert)
    if not cert_pat:
        raise SystemExit(f"unknown cert: {cert}")
    cm = list(re.finditer(cert_pat, text))
    if not cm:
        raise SystemExit(f"cert '{cert}' not found")

    # 다음 자격증 등장 전까지가 해당 섹션
    all_cert_starts = []
    for c_pat in CERT_PATTERNS.values():
        all_cert_starts.extend(m.start() for m in re.finditer(c_pat, text))
    all_cert_starts.sort()

    sec_start = cm[0].start()
    sec_end = next(
        (s for s in all_cert_starts if s > sec_start), len(text)
    )
    section = text[sec_start:sec_end]

    # 형 구간 자르기
    form_matches = list(re.finditer(r"(?m)^([AB])형\s*$", section))
    form_span = None
    for i, m in enumerate(form_matches):
        if m.group(1) == form:
            start = m.start()
            end = (
                form_matches[i + 1].start()
                if i + 1 < len(form_matches)
                else len(section)
            )
            form_span = section[start:end]
            break
    if form_span is None:
        raise SystemExit(f"form '{form}' not found in cert '{cert}'")

    aliases = SUBJECT_ALIAS.get(subject_id, [])
    for line in form_span.splitlines():
        for alias in aliases:
            # 공백 포함된 alias 또는 축약형 둘 다 대응
            if line.strip().startswith(alias):
                circles = [c for c in line if c in CIRCLE_TO_INDEX]
                if len(circles) != 20:
                    raise SystemExit(
                        f"line for {subject_id} has {len(circles)} circles (expected 20): {line}"
                    )
                return [CIRCLE_TO_INDEX[c] for c in circles]

    raise SystemExit(
        f"subject '{subject_id}' row not found in {cert}/{form}"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--answer-pdf", required=True)
    ap.add_argument("--cert", required=True)
    ap.add_argument("--form", required=True, choices=["A", "B"])
    ap.add_argument("--tag", required=True)
    ap.add_argument("--data-root", default="data/questions")
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")

    total_fail = 0
    total_checked = 0
    for subject_id in SUBJECT_ALIAS:
        json_path = os.path.join(args.data_root, subject_id, f"{args.tag}.json")
        if not os.path.exists(json_path):
            continue
        try:
            expected = extract_answer_line(
                args.answer_pdf, args.cert, args.form, subject_id
            )
        except SystemExit as e:
            print(f"SKIP {subject_id}: {e}")
            continue
        with open(json_path, encoding="utf-8") as f:
            qs = json.load(f)
        qs.sort(key=lambda q: q["number"])
        if len(qs) != 20:
            print(f"{subject_id}: {len(qs)}문항 (expected 20)")
        for i, q in enumerate(qs):
            total_checked += 1
            if q["answer"] != expected[i]:
                total_fail += 1
                print(
                    f"{subject_id} Q{q['number']}: JSON={q['answer']} vs PDF={expected[i]}"
                )
        print(f"{subject_id}: {len(qs)}문항 검증")

    print()
    print(f"총 {total_checked}문항, 불일치 {total_fail}")
    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
