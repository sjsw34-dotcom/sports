# PDF_PARSING.md — PDF 기출문제 → JSON 변환

## 1. 전체 흐름

```
[원본 PDF]
    ↓ pdfplumber로 텍스트 추출
[raw_text.txt]
    ↓ Claude API (Sonnet 4.6)로 구조화
[parsed.json (초안)]
    ↓ 사람 검수 + concept 태깅
[final.json (verified: true)]
    ↓ npm run validate:data
[커밋]
```

## 2. 폴더 배치

```
public/exams/
├── 2024/
│   ├── sports-psychology.pdf
│   ├── exercise-physiology.pdf
│   └── ...
├── 2023/
└── ...

data/questions/
├── sports-psychology/
│   ├── 2024.json
│   ├── 2023.json
└── ...
```

## 3. 스크립트 사용법

```bash
# 단일 과목 변환
python scripts/pdf_to_json.py \
  --input public/exams/2024/sports-psychology.pdf \
  --subject sports-psychology \
  --year 2024 \
  --output data/questions/sports-psychology/2024.json

# 배치 변환 (한 해의 모든 과목)
python scripts/pdf_to_json.py --batch --year 2024
```

## 4. 스크립트 내부 로직 (구현 가이드)

### 4.1 텍스트 추출
- `pdfplumber`로 페이지별 텍스트 추출
- 표/이미지가 있는 경우 `pdf2image` + OCR(tesseract) fallback
- 문제 번호(`1.`, `01.`, `문 1` 등) 패턴으로 문제 단위 분리

### 4.2 Claude API 호출
- 모델: `claude-sonnet-4-6` (비용 효율)
- 프롬프트: 시스템에 스키마 JSON + "정확히 이 구조로 반환" 지시
- Output: JSON array of Question

### 4.3 프롬프트 템플릿 (scripts/prompts/pdf_to_questions.txt)

```
다음은 체육지도자 자격증 필기시험 기출문제 PDF에서 추출한 텍스트다.
아래 스키마에 맞춰 각 문제를 JSON 배열로 구조화하라.

[스키마]
{
  "number": number,
  "question": string,
  "choices": [string, string, string, string],
  "answer": number (0-3, 정답란에서 파싱)
}

[규칙]
- 문제 본문에서 불필요한 공백, 줄바꿈 정리
- 선택지 번호(①②③④ 또는 1)2)3)4))는 제거하고 텍스트만
- 정답이 텍스트에 없으면 answer는 -1로 표기 (나중에 수동 입력)
- 표/그림 참조 문제는 `[표 참조]` 같은 플레이스홀더 유지

[입력 텍스트]
{{EXTRACTED_TEXT}}

[출력]
JSON 배열만 반환. 다른 텍스트 금지.
```

### 4.4 해설 및 conceptIds 자동 생성 (2단계)

1단계에서 나온 문제 JSON에 해설이 없으면, 두 번째 Claude 호출:

```
다음 체육지도자 시험 문제에 대한 해설과 관련 개념을 생성하라.

[문제]
{{QUESTION}}

[선택지]
{{CHOICES}}

[정답]
{{ANSWER}}

[현재 등록된 개념 리스트]
{{CONCEPTS_CATALOG}}

[요구사항]
1. 250~400자 해설 (한국어, 수험생 눈높이)
2. 해설 안 핵심 용어는 반드시 {{concept:concept-id}} 형태로 태깅
3. 태깅할 개념은 [현재 등록된 개념 리스트]에서만 선택
4. 새 개념이 필요하면 "new_concepts" 필드에 따로 나열
5. em dash(—) 사용 금지

[출력 JSON]
{
  "explanation": string,
  "conceptIds": string[],
  "new_concepts": [
    { "id": string, "name": string, "definition": string }
  ]
}
```

## 5. 사람 검수 체크리스트

JSON 초안이 나오면 마스터가 직접 확인:

- [ ] 문제 본문 오탈자 없음
- [ ] 선택지 4개 모두 정확
- [ ] 정답 인덱스 검증 (실제 정답과 일치)
- [ ] 해설 내용 정확성 (공식 해설지 또는 교재 대조)
- [ ] `{{concept:...}}` 태그 적절
- [ ] `conceptIds` 배열이 태그와 일치
- [ ] 난이도 태깅 (easy/mid/hard)
- [ ] `verified: true` 플래그 추가

검수 완료 후에만 커밋.

## 6. 새 개념 처리

Claude가 "이 개념은 사전에 없다"고 new_concepts를 제안한 경우:

1. 마스터가 `concepts.json`에 수동 추가 (또는 스크립트로 append)
2. `relatedConceptIds`, `importance`, `keywords` 수동 채움
3. 검증: `npm run validate:data`

## 7. 표/그림 있는 문제 처리

- 표 데이터 → 마크다운 표로 변환해 `question` 필드에 포함
- 그림 필수 문제 → `public/assets/images/{year}-{subject}-{num}.png`로 저장
- 문제 본문에 `![그림](/assets/images/...)` 삽입
- `tags` 배열에 `"image-required"` 추가

## 8. 스크립트 스켈레톤 (pdf_to_json.py)

```python
#!/usr/bin/env python3
"""PDF 기출문제를 JSON으로 변환."""
import argparse
import json
import os
from pathlib import Path
import pdfplumber
from anthropic import Anthropic

client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = "claude-sonnet-4-6"

def extract_text(pdf_path: Path) -> str:
    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
    return "\n\n".join(text_parts)

def parse_questions(raw_text: str) -> list:
    prompt = Path("scripts/prompts/pdf_to_questions.txt").read_text()
    prompt = prompt.replace("{{EXTRACTED_TEXT}}", raw_text)
    resp = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(resp.content[0].text)

def generate_explanations(questions: list, concepts: list) -> list:
    # 각 문제에 해설 + conceptIds 붙이기
    # ...
    return questions

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--subject", required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    raw = extract_text(Path(args.input))
    questions = parse_questions(raw)

    concepts = json.loads(Path("data/concepts.json").read_text())
    questions = generate_explanations(questions, concepts)

    # ID 부여 + 메타 채우기
    for q in questions:
        q["id"] = f"{args.year}-{args.subject}-{q['number']}"
        q["subjectId"] = args.subject
        q["year"] = args.year
        q["sourcePdf"] = Path(args.input).name
        q["verified"] = False  # 사람 검수 전

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(
        json.dumps(questions, ensure_ascii=False, indent=2)
    )
    print(f"✅ {len(questions)}개 문제 저장: {args.output}")
    print(f"⚠️ 반드시 사람 검수 후 verified: true로 변경하세요.")

if __name__ == "__main__":
    main()
```

## 9. 주의사항

- **저작권**: 공식 기출문제는 국민체육진흥공단 저작물. 개인 학습용으로만 사용, **공개 배포 금지**
- **공식 해설이 있는 경우** 해설 작성 시 공식 해설을 참고하되 그대로 복제 금지. 본인 언어로 재작성.
- Claude API 비용: 과목당 약 $0.5~1.5 예상 (문제 + 해설 생성 포함)
