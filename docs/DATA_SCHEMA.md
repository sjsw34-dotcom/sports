# DATA_SCHEMA.md — 데이터 스키마 정의

## 1. 파일 구조

```
data/
├── subjects.json              # 과목 메타데이터 배열
├── certifications.json        # 자격증 정의 배열
├── concepts.json              # 전체 개념 사전 배열
└── questions/
    └── {subject-id}/
        ├── {year}.json        # 과년도 기출 (source: "past-exam")
        ├── {year}-practice.json   # 연습문제 (source: "practice")
        └── {year}-predicted.json  # 예상문제 (source: "predicted")
```

### 1.1 파일명 규칙
- `{year}.json` (suffix 없음): 해당 연도 공식 기출만 수록. 모든 항목이 `source: "past-exam"`.
- `{year}-practice.json`: 해당 연도 출제기준을 바탕으로 만든 연습문제. `source: "practice"`.
- `{year}-predicted.json`: 출제 가능성이 높은 예상문제. `source: "predicted"`.
- 한 파일 안의 모든 문제는 동일한 `source`를 가진다.

### 1.2 ID 규칙
- 과년도 기출: `{year}-{subjectId}-{number}` 예) `2024-sports-psychology-15`
- 연습문제: `{year}-{subjectId}-p{NN}` 예) `2024-sports-psychology-p01`
- 예상문제: `{year}-{subjectId}-e{NN}` 예) `2024-sports-psychology-e01`

## 2. TypeScript 타입 정의

`src/lib/types.ts`에 그대로 반영할 것.

### 2.1 Enums

```typescript
export type SubjectId =
  | "sports-education"       // 스포츠교육학
  | "sports-sociology"       // 스포츠사회학
  | "sports-psychology"      // 스포츠심리학
  | "exercise-physiology"    // 운동생리학
  | "exercise-mechanics"     // 운동역학
  | "korean-pe-history"      // 한국체육사
  | "sports-ethics"          // 스포츠윤리
  | "youth-pe"               // 유아체육론
  | "senior-pe";             // 노인체육론

export type CertId =
  | "life-2"       // 생활스포츠지도사 2급
  | "youth"        // 유소년스포츠지도사
  | "senior";      // 노인스포츠지도사

export type Difficulty = "easy" | "mid" | "hard";

export type QuestionSource =
  | "past-exam"    // 과년도 기출
  | "predicted"    // 예상문제 (출제기준 기반 생성)
  | "practice";    // 연습문제 (개념 다지기용)
```

### 2.2 Subject

```typescript
export interface Subject {
  id: SubjectId;
  name: string;              // "스포츠심리학"
  shortName: string;         // "심리"
  nameEn: string;            // "Sports Psychology"
  description: string;
  icon: string;              // 이모지: "🧠"
  color: string;             // hex: "#8B5CF6"
  requiredFor: {
    certId: CertId;
    type: "required" | "optional";
  }[];
  totalQuestions?: number;   // 집계용 (빌드 시 자동 계산)
}
```

### 2.3 Question

```typescript
export interface Question {
  id: string;                // "2024-sports-psychology-15"
  subjectId: SubjectId;
  year: number;              // 2024
  number: number;            // 문제 번호 (1-20)
  question: string;          // 문제 본문 (마크다운 가능)
  choices: string[];         // 4지선다. length === 4
  answer: number;            // 정답 인덱스 0~3
  explanation: string;       // 기본 해설 (마크다운 + {{concept:id}} 태그)
  enhancedExplanation?: string; // 심화 해설 (원리/맥락/유사 기출 비교 등)
  conceptIds: string[];      // 이 문제가 다루는 개념들의 id
  source: QuestionSource;    // 출처 구분. "past-exam"이 기본
  difficulty?: Difficulty;
  tags?: string[];           // 자유 태그 ["고전역학", "뉴턴"]
  sourcePdf?: string;        // 원본 PDF 파일명 (past-exam인 경우)
  sourceRef?: string;        // 참고 출처 (predicted/practice인 경우, URL 또는 교재명)
  verified: boolean;         // 사람 검수 완료 여부
  createdAt: string;         // ISO 8601
  updatedAt: string;
}
```

### 2.4 Concept (개념 사전)

```typescript
export interface Concept {
  id: string;                // "stages-of-motor-learning" (kebab-case)
  name: string;              // "운동학습의 단계"
  nameEn?: string;
  subjectId: SubjectId;
  definition: string;        // 한 줄 정의
  details: string;           // 상세 설명 (마크다운 + {{concept:id}} 가능)
  relatedConceptIds: string[];
  keywords: string[];        // 검색/매칭용
  importance: 1 | 2 | 3;     // 1=기본, 3=최중요
  sources?: string[];        // 참고 출처
}
```

### 2.5 Certification

```typescript
export interface Certification {
  id: CertId;
  name: string;              // "생활스포츠지도사 2급"
  level: string;             // "2급"
  type: "life" | "youth" | "senior" | "pro" | "disabled" | "health";
  requiredSubjects: SubjectId[];
  optionalSubjects: SubjectId[];
  examConfig: {
    totalSubjects: number;   // 선택해야 할 과목 수
    questionsPerSubject: number;
    timeLimit: number;       // 분
    passingScore: number;    // 각 과목 만점의 %
  };
}
```

## 3. 예시 데이터

### 3.1 subjects.json (일부)

```json
[
  {
    "id": "sports-psychology",
    "name": "스포츠심리학",
    "shortName": "심리",
    "nameEn": "Sports Psychology",
    "description": "스포츠 상황에서의 행동, 인지, 감정을 다루는 학문",
    "icon": "🧠",
    "color": "#8B5CF6",
    "requiredFor": [
      { "certId": "life-2", "type": "optional" },
      { "certId": "youth", "type": "optional" },
      { "certId": "senior", "type": "optional" }
    ]
  },
  {
    "id": "youth-pe",
    "name": "유아체육론",
    "shortName": "유아",
    "nameEn": "Youth Physical Education",
    "description": "유아 대상 신체활동 지도 이론",
    "icon": "🧒",
    "color": "#F59E0B",
    "requiredFor": [
      { "certId": "youth", "type": "required" }
    ]
  }
]
```

### 3.2 questions/sports-psychology/2024.json (일부)

```json
[
  {
    "id": "2024-sports-psychology-15",
    "subjectId": "sports-psychology",
    "year": 2024,
    "number": 15,
    "question": "Fitts와 Posner(1967)의 운동학습 단계 중 **인지 단계**에 대한 설명으로 옳은 것은?",
    "choices": [
      "동작이 자동화되어 주의 자원이 거의 필요하지 않다",
      "학습자가 과제의 목표와 요구를 이해하려 한다",
      "오류가 감소하고 일관성이 증가한다",
      "상황 변화에 유연하게 대처할 수 있다"
    ],
    "answer": 1,
    "explanation": "Fitts와 Posner의 {{concept:stages-of-motor-learning}}는 인지-연합-자동화 3단계로 구성된다. 인지 단계는 학습 초기로, 학습자가 과제의 목표와 수행 방식을 인지적으로 이해하려 노력하는 단계다. 오류가 많고 수행이 불안정하다. 관련하여 {{concept:attention-resources}}의 개념도 함께 이해해야 한다.",
    "conceptIds": ["stages-of-motor-learning", "attention-resources"],
    "difficulty": "mid",
    "tags": ["운동학습", "Fitts-Posner"],
    "sourcePdf": "2024-sports-psychology.pdf",
    "verified": true,
    "createdAt": "2026-04-20T10:00:00Z",
    "updatedAt": "2026-04-20T10:00:00Z"
  }
]
```

### 3.3 concepts.json (일부)

```json
[
  {
    "id": "stages-of-motor-learning",
    "name": "운동학습의 단계",
    "nameEn": "Stages of Motor Learning",
    "subjectId": "sports-psychology",
    "definition": "Fitts와 Posner가 제안한 운동기술 습득의 3단계 모델",
    "details": "## 3단계 구성\n\n1. **인지 단계 (Cognitive Stage)**: 과제 목표 이해, 오류 多, 주의집중 필요\n2. **연합 단계 (Associative Stage)**: 오류 감소, 일관성 증가, 미세 조정\n3. **자동화 단계 (Autonomous Stage)**: 자동 수행, 주의 자원 최소, 이중과제 가능\n\n관련 개념: {{concept:attention-resources}}, {{concept:feedback-types}}",
    "relatedConceptIds": ["attention-resources", "feedback-types", "motor-control"],
    "keywords": ["Fitts", "Posner", "인지단계", "연합단계", "자동화", "운동학습"],
    "importance": 3,
    "sources": ["Fitts & Posner (1967)"]
  }
]
```

## 4. 유효성 검증 규칙

`scripts/validate_data.ts` 또는 `npm run validate:data`에서 확인.

### 4.1 Question
- `choices.length === 4`
- `0 <= answer <= 3`
- `conceptIds` 내 모든 ID가 `concepts.json`에 존재
- 해설(`explanation`, `enhancedExplanation`) 안 `{{concept:xxx}}` 태그의 모든 xxx가 `concepts.json`에 존재
- `id` 형식: §1.2 참조. source에 맞는 패턴 준수
- 파일 내 모든 문제의 `source`가 일치해야 함

### 4.2 Concept
- `id` 형식: kebab-case
- `relatedConceptIds` 내 모든 ID가 `concepts.json`에 존재 (자기 자신 제외)
- `details` 안 `{{concept:xxx}}` 태그도 동일하게 검증

### 4.3 양방향 관계
- Concept A의 `relatedConceptIds`에 B가 있으면, B의 `relatedConceptIds`에도 A가 있어야 함 (경고)

## 5. 확장 시 규칙

- 새 과목 추가 시: `subjects.json`에 추가 + `data/questions/{subject-id}/` 폴더 생성 + `types.ts`의 `SubjectId`에 추가
- 새 자격증 추가 시: `certifications.json`에 추가 + `CertId` 확장
- 스키마 변경 시: **마이그레이션 스크립트 필수**, 기존 JSON 전수 변환 후 커밋
