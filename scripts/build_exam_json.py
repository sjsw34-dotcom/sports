"""파싱 결과를 앱 스키마에 맞춰 최종 JSON으로 저장.

사용 예:
    python scripts/build_exam_json.py \
        --questions scripts/out/2019_life_A.json \
        --answers   scripts/out/2019_life2_answers.json \
        --cert      life-2 \
        --form      A \
        --year      2019 \
        --source    past-exam \
        --out-root  data/questions \
        --tag       2019-life2-A
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone


def iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build(
    questions_by_subject: dict[str, list[dict]],
    answers_by_subject: dict[str, dict[str, int]],
    year: int,
    form: str,
    source: str,
    tag: str,
) -> dict[str, list[dict]]:
    """과목별 Question[] 생성."""
    out: dict[str, list[dict]] = {}
    now = iso_now()

    for subject_id, qs in questions_by_subject.items():
        answer_map = answers_by_subject.get(subject_id, {})
        # JSON key는 문자열이므로 int로 복원
        answer_map_int = {int(k): v for k, v in answer_map.items()}

        built: list[dict] = []
        for q in sorted(qs, key=lambda x: x["number"]):
            num = q["number"]
            ans = answer_map_int.get(num)
            if ans is None:
                # 정답 없는 문제는 제외 (수동 검수에 남김)
                continue
            needs_images = bool(q.get("needsImages"))
            qid = f"{year}-{subject_id}-{form.lower()}-{num:02d}"
            built.append(
                {
                    "id": qid,
                    "subjectId": subject_id,
                    "year": year,
                    "number": num,
                    "question": q["question"],
                    "choices": q["choices"],
                    "answer": ans,
                    "explanation": "",
                    "conceptIds": [],
                    "source": source,
                    "tags": [tag],
                    "sourceRef": tag,
                    "verified": False,
                    "needsImages": needs_images,
                    "createdAt": now,
                    "updatedAt": now,
                }
            )
        out[subject_id] = built
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", required=True)
    ap.add_argument("--answers", required=True)
    ap.add_argument("--cert", required=True)
    ap.add_argument("--form", required=True, choices=["A", "B"])
    ap.add_argument("--year", required=True, type=int)
    ap.add_argument("--source", default="past-exam")
    ap.add_argument("--out-root", default="data/questions")
    ap.add_argument("--tag", required=True, help="파일명·sourceRef용 태그")
    args = ap.parse_args()

    with open(args.questions, encoding="utf-8") as f:
        questions_by_subject: dict[str, list[dict]] = json.load(f)
    with open(args.answers, encoding="utf-8") as f:
        answers_root = json.load(f)

    cert_section = answers_root.get(args.cert, {})
    form_section = cert_section.get(args.form, {})
    if not form_section:
        raise SystemExit(f"정답가안에서 {args.cert}/{args.form}를 찾지 못함")

    final = build(
        questions_by_subject,
        form_section,
        args.year,
        args.form,
        args.source,
        args.tag,
    )

    # 과목별 파일 기록
    for subject_id, items in final.items():
        if not items:
            continue
        dir_path = os.path.join(args.out_root, subject_id)
        os.makedirs(dir_path, exist_ok=True)
        file_path = os.path.join(dir_path, f"{args.tag}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"{file_path}: {len(items)}문항")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
