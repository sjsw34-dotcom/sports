"""정답가안 PDF 파싱.

구조: 자격증 제목 → A형/B형 → '과목 1 2 ... 20' 헤더 → 과목별 행(①②③④).
출력: {certification: {form: {subject_id: {number: answer_index}}}}
"""
from __future__ import annotations

import argparse
import json
import re
import sys

import pdfplumber


CIRCLE_TO_INDEX = {"①": 0, "②": 1, "③": 2, "④": 3, "⑤": 4}

SUBJECT_NAME_MAP = {
    "스포츠사회학": "sports-sociology",
    "스포츠교육학": "sports-education",
    "스포츠심리학": "sports-psychology",
    "한국체육사": "korean-pe-history",
    "운동생리학": "exercise-physiology",
    "운동역학": "exercise-mechanics",
    "스포츠윤리": "sports-ethics",
    "유아체육론": "youth-pe",
    "노인체육론": "senior-pe",
    "특수체육론": "adapted-pe",
}

CERT_PATTERNS = {
    "life-2": re.compile(r"2급 생활스포츠지도사"),
    "pro-2": re.compile(r"2급 전문스포츠지도사"),
    "disabled-2": re.compile(r"2급 장애인스포츠지도사"),
    "youth": re.compile(r"유소년스포츠지도사"),
    "senior": re.compile(r"노인스포츠지도사"),
    "life-1": re.compile(r"1급 생활스포츠지도사"),
    "pro-1": re.compile(r"1급 전문스포츠지도사"),
    "disabled-1": re.compile(r"1급 장애인스포츠지도사"),
    "health": re.compile(r"건강운동관리사"),
}

FORM_RE = re.compile(r"^([AB])형\s*$")


def normalize_subject(name: str) -> str | None:
    k = re.sub(r"\s+", "", name)
    return SUBJECT_NAME_MAP.get(k)


def parse_answers_from_pdf(
    path: str,
) -> dict[str, dict[str, dict[str, dict[int, int]]]]:
    """{cert_id: {form: {subject_id: {num: idx}}}}"""
    result: dict[str, dict[str, dict[str, dict[int, int]]]] = {}

    with pdfplumber.open(path) as pdf:
        full = "\n".join((pg.extract_text() or "") for pg in pdf.pages)

    # 자격증별 섹션 경계 찾기
    cert_spans: list[tuple[str, int, int]] = []
    cert_matches: list[tuple[str, int]] = []
    for cid, pat in CERT_PATTERNS.items():
        for m in pat.finditer(full):
            cert_matches.append((cid, m.start()))
    cert_matches.sort(key=lambda x: x[1])
    for i, (cid, start) in enumerate(cert_matches):
        end = cert_matches[i + 1][1] if i + 1 < len(cert_matches) else len(full)
        cert_spans.append((cid, start, end))

    for cid, start, end in cert_spans:
        section = full[start:end]
        result.setdefault(cid, {})
        # 형 단위 쪼갬
        form_positions: list[tuple[str, int]] = []
        for m in re.finditer(r"(?m)^([AB])형\s*$", section):
            form_positions.append((m.group(1), m.start()))
        for i, (form, fstart) in enumerate(form_positions):
            fend = (
                form_positions[i + 1][1]
                if i + 1 < len(form_positions)
                else len(section)
            )
            form_body = section[fstart:fend]
            result[cid].setdefault(form, {})
            for line in form_body.splitlines():
                line = line.strip()
                if not line:
                    continue
                # 과목명 + 동그라미 답안 20개
                # 과목명은 공백 섞여 나올 수 있음 ("한 국 체 육 사")
                parts = line.split()
                # circle 문자 추출
                circles = [c for c in parts if c in CIRCLE_TO_INDEX]
                if len(circles) != 20:
                    continue
                # 과목명 조립
                name_parts = [p for p in parts if p not in CIRCLE_TO_INDEX]
                sname = "".join(name_parts)
                sid = normalize_subject(sname)
                if not sid:
                    continue
                answers = {i + 1: CIRCLE_TO_INDEX[c] for i, c in enumerate(circles)}
                result[cid][form][sid] = answers

    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--output")
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    data = parse_answers_from_pdf(args.pdf)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"wrote {args.output}", file=sys.stderr)
    else:
        print(json.dumps(data, ensure_ascii=False, indent=2))

    # summary
    for cid, forms in data.items():
        for form, subs in forms.items():
            for sid, answers in subs.items():
                print(
                    f"{cid}/{form}/{sid}: {len(answers)}문항",
                    file=sys.stderr,
                )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
