"""추출된 기출 텍스트를 과목 → 문제 구조로 파싱한다.

입력: scripts/out/*.txt (extract_exam_pdf.py의 출력)
출력: 과목별 문제 리스트 (JSON)

과목 헤더 예: "스포츠사회학 (11)", "스포츠교육학 (22)", ...
문제 포맷: "\d+\. ... ① ... ② ... ③ ... ④ ..."
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict


# 공식 과목 코드 (KSPO)
SUBJECT_HEADERS = {
    "스포츠사회학": "sports-sociology",
    "스포츠교육학": "sports-education",
    "스포츠심리학": "sports-psychology",
    "한국체육사": "korean-pe-history",
    "운동생리학": "exercise-physiology",
    "운동역학": "exercise-mechanics",
    "스포츠윤리": "sports-ethics",
    "유아체육론": "youth-pe",
    "노인체육론": "senior-pe",
    "특수체육론": "adapted-pe",  # 장애인용 (현재 앱 범위 외)
}

# 과목 헤더 패턴: "스포츠사회학 (11)" 형식
HEADER_RE = re.compile(
    r"^(?P<name>(" + "|".join(map(re.escape, SUBJECT_HEADERS)) + r"))\s*\((?P<code>\d+)\)\s*$",
    re.MULTILINE,
)

# OCR 자주 틀리는 과목명 ↔ 정규화 (extract 단계에서 교정)
OCR_SUBJECT_FIXES = [
    (re.compile(r"스포츠운리"), "스포츠윤리"),
    (re.compile(r"스포츠 운리"), "스포츠윤리"),
]

# 문제 시작 패턴: 줄 시작에 "숫자." (OCR에서 점이 누락될 수 있어 점 선택적)
Q_START_RE = re.compile(r"(?m)^(?P<num>\d+)\.?\s")

# 보기 선택지 문자 (① ② ③ ④)
CHOICE_CHARS = ["①", "②", "③", "④"]

# 페이지·자격증 헤더 노이즈 제거 (라인 단위)
NOISE_LINE_PATTERNS = [
    re.compile(r"^\s*\[\[PAGE \d+\]\]\s*$"),
    re.compile(r"^\s*2019\.\s*\d+"),
    re.compile(r"^\s*2급 생활스포츠\s*$"),
    re.compile(r"^.*필기시험( A형| B형)?\s*$"),
    re.compile(r"^도사 필기시험.*$"),
    re.compile(r"^\s*\( 문제.*$"),
    re.compile(r"^\s*\(5과목\).*$"),
    re.compile(r"^\s*선택\s.*$"),
    re.compile(r"^\s*과\s*목\s*코\s*드\s*$"),
    re.compile(r"^\s*스\s*포\s*츠\s*[가-힣]"),  # 표지의 과목명 테이블
    re.compile(r"^\s*한\s*국\s*체\s*육\s*사"),
    re.compile(r"^\s*운\s*동\s*[가-힣]+\s*\d+"),
    re.compile(r"^\s*\d{1,2}\s*$"),  # 페이지 번호만
    re.compile(r"^\s*-\s*\d+\s*-\s*$"),
]


@dataclass
class ParsedQuestion:
    number: int
    question: str
    choices: list[str]
    needsImages: bool = False


def clean_lines(text: str) -> str:
    out = []
    for line in text.splitlines():
        if any(p.match(line) for p in NOISE_LINE_PATTERNS):
            continue
        out.append(line)
    return "\n".join(out)


def split_by_subject(text: str) -> dict[str, str]:
    """과목 헤더 단위로 텍스트 분할. 헤더 위치를 먼저 모은 뒤 구간 자르기."""
    matches = list(HEADER_RE.finditer(text))
    if not matches:
        return {}
    sections: dict[str, str] = {}
    for i, m in enumerate(matches):
        name = m.group("name")
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end]
        # 같은 헤더가 재등장하면 이어 붙임
        sections[name] = sections.get(name, "") + "\n" + body
    return sections


def parse_questions(section_text: str) -> list[ParsedQuestion]:
    """과목 본문에서 '번호. 질문 ①~④' 형태의 문제 블록 추출."""
    text = clean_lines(section_text).strip()
    starts = list(Q_START_RE.finditer(text))
    by_num: dict[int, ParsedQuestion] = {}
    for i, m in enumerate(starts):
        num = int(m.group("num"))
        # 문제 번호는 1~20 범위
        if not (1 <= num <= 20):
            continue
        begin = m.end()
        end = starts[i + 1].start() if i + 1 < len(starts) else len(text)
        body = text[begin:end].strip()
        parsed = parse_single_block(body)
        if parsed is None:
            # 표/이미지 기반 문제 — ①②③④ 순서 깨짐 또는 OCR 누락.
            # 본문 전체를 question으로 두고 choices 비워 needsImages=True로 표기.
            candidate = ParsedQuestion(
                number=num,
                question=normalize_ws(body),
                choices=["", "", "", ""],
                needsImages=True,
            )
        else:
            needs_images = all(len(c) == 0 for c in parsed["choices"])
            candidate = ParsedQuestion(
                number=num,
                question=parsed["question"],
                choices=parsed["choices"],
                needsImages=needs_images,
            )
        # 중복: 더 구체적인(choices 있음 > 본문 길이 긴) 쪽 선택
        prev = by_num.get(num)
        if prev is None:
            by_num[num] = candidate
        else:
            prev_has_choices = any(c for c in prev.choices)
            cand_has_choices = any(c for c in candidate.choices)
            if cand_has_choices and not prev_has_choices:
                by_num[num] = candidate
            elif (
                cand_has_choices == prev_has_choices
                and len(candidate.question) > len(prev.question)
            ):
                by_num[num] = candidate
    return sorted(by_num.values(), key=lambda q: q.number)


def parse_single_block(body: str) -> dict | None:
    """한 문제 블록에서 질문과 4개 보기 분리."""
    # ① 위치 찾기
    choice_positions: list[int] = []
    for ch in CHOICE_CHARS:
        idx = body.find(ch)
        if idx < 0:
            return None
        # 같은 문자 중복 등장은 첫 번째 사용
        choice_positions.append(idx)
    # 오름차순이 깨지면 파싱 실패로 간주
    if any(choice_positions[i] >= choice_positions[i + 1] for i in range(3)):
        return None

    question_part = body[: choice_positions[0]].strip()
    choices: list[str] = []
    for i in range(4):
        start = choice_positions[i] + 1  # skip ① 문자
        end = choice_positions[i + 1] if i + 1 < 4 else len(body)
        ch_text = body[start:end].strip()
        choices.append(normalize_ws(ch_text))

    question_clean = normalize_ws(question_part)
    return {"question": question_clean, "choices": choices}


def normalize_ws(s: str) -> str:
    """줄바꿈/다중 공백 → 단일 공백, 한자·기호 그대로 유지."""
    return re.sub(r"\s+", " ", s).strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("text_file")
    ap.add_argument("-o", "--output", help="JSON 출력 경로")
    args = ap.parse_args()

    with open(args.text_file, "r", encoding="utf-8") as f:
        raw = f.read()

    # OCR 과목명 교정
    for pat, repl in OCR_SUBJECT_FIXES:
        raw = pat.sub(repl, raw)

    sections = split_by_subject(raw)
    result: dict[str, list[dict]] = {}
    for name, section in sections.items():
        qs = parse_questions(section)
        subject_id = SUBJECT_HEADERS[name]
        result[subject_id] = [asdict(q) for q in qs]

    sys.stdout.reconfigure(encoding="utf-8")
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"wrote {args.output}", file=sys.stderr)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))

    # summary
    for sid, qs in result.items():
        nums = sorted(q["number"] for q in qs)
        gaps = [i for i in range(1, 21) if i not in nums]
        print(
            f"{sid}: {len(qs)}문항 numbers={nums[:5]}..{nums[-3:] if len(nums) > 5 else ''} missing={gaps}",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
