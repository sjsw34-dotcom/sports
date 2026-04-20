# CLAUDE.md — 체육지도자 자격증 학습 사이트 (chedo-prep)

> Claude Code가 이 프로젝트에서 작업할 때 **반드시 먼저 읽어야 하는 루트 문서**.
> 모든 작업은 이 문서의 규칙을 따른다.

---

## 1. 프로젝트 개요

### 1.1 목적
체육지도자 자격증(생활스포츠지도사 2급 / 유소년 / 노인) **필기시험** 대비를 위한 **모바일 우선 PWA 학습 사이트**.
과년도 기출문제를 과목·연도별로 풀고, 해설과 함께 **관련 개념을 링크로 연결**해 개념망을 구축하며 학습한다.

### 1.2 타겟 자격증 (1차 범위)
3종을 통합으로 커버한다. 필기 과목이 대부분 겹쳐서 데이터 재사용률이 높다.

| 자격증 | 선택/필수 구조 |
|---|---|
| **생활스포츠지도사 2급** | 7과목 중 5과목 선택 (스포츠교육학, 스포츠사회학, 스포츠심리학, 운동생리학, 운동역학, 한국체육사, 스포츠윤리) |
| **유소년스포츠지도사** | 위 7과목 중 4과목 선택 + "유아체육론" 필수 |
| **노인스포츠지도사** | 위 7과목 중 4과목 선택 + "노인체육론" 필수 |

> **향후 확장**: 1급 생활, 1/2급 전문, 1/2급 장애인, 건강운동관리사 → 폴더 구조는 처음부터 확장 가능하게 설계.

### 1.3 대상 사용자
본인(마스터) 개인 학습용. 단, 구조는 다인 확장 가능하게.

---

## 2. 기술 스택 (고정)

- **프레임워크**: Next.js 14 (App Router) + TypeScript (strict)
- **스타일**: Tailwind CSS + shadcn/ui
- **로컬 저장**: IndexedDB (Dexie.js 래퍼) — 오답노트·북마크·진도·세션
- **데이터**: 정적 JSON (`/data/`), 원본 PDF는 `/public/exams/`에 보관
- **차트**: Recharts (통계 대시보드용)
- **PWA**: next-pwa
- **배포**: Vercel
- **테스트**: Vitest (유틸 함수만)

### 2.1 쓰지 않는 것
- 서버 DB (Neon/Supabase 등) — 개인 학습용이고 정적 JSON이 더 빠르고 단순하다.
- 인증 (NextAuth 등) — 1차 범위에서는 단일 사용자.
- ORM — JSON 읽기만 하므로 불필요.

---

## 3. 프로젝트 구조

```
chedo-prep/
├── CLAUDE.md                    # (이 파일) 루트 가이드
├── docs/
│   ├── DATA_SCHEMA.md           # JSON 스키마 정의
│   ├── PDF_PARSING.md           # PDF→JSON 변환 규칙
│   ├── UX_PRINCIPLES.md         # 모바일 UX 원칙
│   └── CONCEPT_LINKING.md       # 개념 연계 설계
├── scripts/
│   ├── pdf_to_json.py           # PDF 기출 → JSON 변환 스크립트
│   └── validate_data.ts         # JSON 유효성 검증
├── public/
│   └── exams/                   # 원본 PDF (연도별)
│       ├── 2024/
│       ├── 2023/
│       └── ...
├── data/                        # 구조화된 문제 JSON (Git으로 관리)
│   ├── subjects.json            # 과목 메타데이터
│   ├── concepts.json            # 개념 사전 (연계 링크용)
│   ├── questions/
│   │   ├── sports-education/    # 스포츠교육학
│   │   │   ├── 2024.json
│   │   │   ├── 2023.json
│   │   │   └── ...
│   │   ├── sports-sociology/
│   │   ├── sports-psychology/
│   │   ├── exercise-physiology/
│   │   ├── exercise-mechanics/
│   │   ├── korean-pe-history/
│   │   ├── sports-ethics/
│   │   ├── youth-pe/            # 유아체육론 (유소년 전용)
│   │   └── senior-pe/           # 노인체육론 (노인 전용)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # 홈 (최근 학습 + 빠른 시작)
│   │   ├── subjects/            # 과목별 문제풀이 모드
│   │   │   └── [subject]/page.tsx
│   │   ├── years/               # 연도별 기출 모드
│   │   │   └── [year]/[subject]/page.tsx
│   │   ├── concepts/            # 개념 사전
│   │   │   └── [slug]/page.tsx
│   │   ├── review/              # 오답노트/북마크
│   │   ├── stats/               # 진도 대시보드
│   │   └── mock/                # 랜덤 모의고사
│   ├── components/
│   │   ├── QuestionCard.tsx
│   │   ├── ExplanationPanel.tsx
│   │   ├── ConceptLink.tsx      # 개념 → 개념 사전으로 이동
│   │   ├── BottomNav.tsx        # 모바일 하단 네비
│   │   └── ...
│   ├── lib/
│   │   ├── db.ts                # Dexie 인스턴스
│   │   ├── data-loader.ts       # JSON 로드/캐시
│   │   ├── types.ts             # 전역 타입
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
├── tests/
└── package.json
```

---

## 4. 핵심 기능 (우선순위 순)

우선순위는 마스터 결정에 따름. **1순위부터 차례로 구현**.

### 우선순위 1 — 해설 + 개념 연계 (가장 중요)
- 문제 풀이 후 정답/해설 표시
- 해설 안의 **핵심 용어는 개념 사전으로 링크** (예: "운동학습의 단계" → `/concepts/stages-of-motor-learning`)
- 개념 사전 페이지에서는: 해당 개념 정의 + **이 개념이 등장한 모든 문제 목록** 역참조
- 관련 개념 상호 링크 (예: "운동학습" ↔ "운동제어" ↔ "피드백")

### 우선순위 2 — 과목별 문제풀이 모드
- 7+2 과목 선택 → 해당 과목 전체 문제 랜덤 출제
- 필터: 연도, 난이도, "미풀이만", "틀린 것만"
- 스와이프로 다음 문제, 탭으로 답 선택

### 우선순위 3 — 과년도 연도별 기출 모드
- 연도 선택 → 과목 선택 → 실제 시험처럼 100분 타이머 + 20문항 세트
- 완료 시 점수 + 오답 리뷰

### 우선순위 4 — 오답노트/북마크
- 틀린 문제 자동 누적
- 수동 북마크 (별 아이콘)
- "오답만 다시 풀기" 모드

### 우선순위 5 — 통계/진도 대시보드
- 과목별 정답률
- 연도별 풀이 진도
- 최근 7일/30일 학습 히트맵
- 취약 개념 TOP 10 (오답률 기준)

### 우선순위 6 — 랜덤 모의고사 생성
- 선택한 과목들에서 N문항 랜덤 추출
- 출제빈도 가중치 옵션 (자주 나온 개념 우선)

---

## 5. 데이터 스키마 (핵심)

전체 스키마 정의는 `docs/DATA_SCHEMA.md` 참조. 여기서는 개요만.

### 5.1 Question
```typescript
interface Question {
  id: string;                    // "2024-sports-psych-15"
  subjectId: SubjectId;          // "sports-psychology"
  year: number;                  // 2024
  number: number;                // 15
  question: string;              // 문제 본문
  choices: string[];             // 4지선다 ["1) ...", "2) ...", ...]
  answer: number;                // 정답 인덱스 (0-3)
  explanation: string;           // 해설 (마크다운)
  conceptIds: string[];          // 연계 개념 ID 배열 — 개념 사전 링크용
  difficulty?: "easy" | "mid" | "hard";
  tags?: string[];               // 세부 태그
  sourcePdf?: string;            // 원본 PDF 파일명
}
```

### 5.2 Concept (개념 사전)
```typescript
interface Concept {
  id: string;                    // "stages-of-motor-learning"
  name: string;                  // "운동학습의 단계"
  subjectId: SubjectId;
  definition: string;            // 정의 (마크다운)
  details: string;               // 상세 설명
  relatedConceptIds: string[];   // 연관 개념 (상호 링크)
  keywords: string[];            // 검색용 키워드
}
```

### 5.3 Subject
```typescript
interface Subject {
  id: SubjectId;
  name: string;                  // "스포츠심리학"
  nameEn: string;
  requiredFor: CertId[];         // 어느 자격증에 필수/선택인가
  icon: string;                  // 이모지 or 아이콘명
  color: string;                 // 테마 컬러
}
```

---

## 6. 개념 연계 설계 (Concept Linking) — 이 프로젝트의 차별점

상세는 `docs/CONCEPT_LINKING.md`.

### 6.1 원칙
1. **모든 해설은 개념 사전의 개념들로 구성된다.** 해설 작성 시 핵심 용어는 반드시 `{{concept:stages-of-motor-learning}}` 같은 마크다운 확장 문법으로 태깅한다.
2. 렌더 시 이 태그는 `<ConceptLink>` 컴포넌트로 치환되어 **탭하면 개념 상세 페이지 모달로 뜬다** (페이지 전환 없이).
3. 개념 상세 페이지에는 **이 개념이 등장한 모든 문제 썸네일**이 역참조로 뜬다. → 개념 중심 학습 가능.
4. 관련 개념 간 **양방향 그래프**. 예: "운동학습" 페이지에는 "운동제어", "피드백" 링크가 뜨고, 반대도 마찬가지.

### 6.2 작성 예시 (해설 마크다운)
```markdown
이 문제는 {{concept:stages-of-motor-learning}}의 **인지 단계**에 관한 것이다.
Fitts와 Posner(1967)가 제안한 3단계 모델에 따르면...
관련하여 {{concept:feedback-types}}의 내재적 피드백도 함께 이해해야 한다.
```

---

## 7. 모바일 UX 원칙

상세는 `docs/UX_PRINCIPLES.md`.

### 핵심 규칙
- **한 손 조작 전제**: 주요 버튼은 화면 하단 1/3에 배치
- **폰트 최소 16px** (iOS 자동 줌 방지)
- **터치 영역 최소 44x44px**
- **스와이프**: 좌우 = 이전/다음 문제, 위로 = 해설 펼침
- **하단 고정 네비**: 홈 / 과목 / 기출 / 오답 / 통계
- **다크모드 기본 지원** (눈 피로 고려)
- **오프라인 우선**: PWA 캐시로 데이터 오프라인 접근

---

## 8. PDF → JSON 변환 워크플로우

상세는 `docs/PDF_PARSING.md`.

### 8.1 원칙
원본 PDF는 `public/exams/{year}/{subject}.pdf`에 보관하되, **앱은 JSON만 읽는다**.
PDF는 다운로드/원본 확인용.

### 8.2 변환 절차 (Claude Code에게 지시할 때)
1. `public/exams/2024/sports-psychology.pdf` 업로드 또는 배치
2. `python scripts/pdf_to_json.py --input public/exams/2024/sports-psychology.pdf --output data/questions/sports-psychology/2024.json`
3. 스크립트는 PDF 텍스트 추출 → Claude API 호출 → 구조화 JSON 출력
4. **반드시 수동 검증 단계 포함**: 생성된 JSON을 사람이 확인하고 `verified: true` 플래그 추가
5. `npm run validate:data` 실행해 스키마 검증

### 8.3 해설 생성
기출문제 PDF에는 보통 해설이 없다. 해설은:
1. Claude API로 초안 생성 (프롬프트: "체육지도자 자격증 수험생 눈높이, 한국 공식 교재 용어 사용, 300자 내외")
2. 개념 태그 `{{concept:...}}` 자동 삽입
3. **마스터가 검수 후** `verified: true`

---

## 9. Claude Code 작업 규칙 (필수 준수)

### 9.1 문서 우선
- 코드 작성 전 반드시 `docs/` 안의 관련 문서를 읽을 것
- 새 기능 추가 시 해당 문서도 함께 업데이트

### 9.2 스타일 규칙
- **em dash(—) 사용 금지.** 대신 콤마, 마침표, 괄호로 처리 (마스터 지시사항)
- UI 텍스트는 한국어
- 코드 주석은 한국어 OK, 변수명/함수명은 영어
- TypeScript strict 모드, `any` 금지 (꼭 써야 하면 이유를 주석으로)

### 9.3 파일 작성 규칙
- 컴포넌트는 함수형, named export
- 한 파일 300줄 넘으면 분리 검토
- 스타일은 Tailwind only (CSS Module 금지)

### 9.4 데이터 무결성
- `data/` 안의 JSON 수정 시 반드시 `npm run validate:data` 통과 확인
- 새 문제 추가 시 `conceptIds`가 `concepts.json`에 실제 존재하는지 검증

### 9.5 커밋 규칙
- 커밋 메시지는 한국어 prefix 허용: `feat: 오답노트 모드 추가`, `fix: 스와이프 버그`, `data: 2024 심리학 문제 추가`

### 9.6 의존성 추가
- 새 라이브러리 추가 전 **왜 필요한지 PR 설명에 명시**
- 가능한 한 shadcn/ui 범위 내에서 해결

---

## 10. 개발 명령어

```bash
# 개발
npm run dev              # 로컬 개발 서버

# 빌드
npm run build
npm run start

# 데이터
npm run validate:data    # JSON 스키마 검증
python scripts/pdf_to_json.py --help

# 테스트
npm run test
npm run lint
npm run typecheck
```

---

## 11. 구현 로드맵 (권장 순서)

Claude Code에게 순서대로 지시하세요.

### Phase 0: 초기 세팅 (반나절)
- Next.js 14 프로젝트 생성 + Tailwind + shadcn/ui + PWA 설정
- 기본 레이아웃 (하단 네비, 다크모드 토글)
- Dexie 초기화

### Phase 1: 데이터 기반 (1~2일)
- `data/subjects.json`, `data/concepts.json` 초기 스켈레톤
- **샘플 과목 1개** (스포츠심리학) 2024년도 문제 수동 입력 (20문항)
- 관련 개념 20개 작성
- 스키마 validator 작성

### Phase 2: 핵심 기능 (우선순위 1~2)
- QuestionCard + ExplanationPanel + ConceptLink
- 과목별 문제풀이 모드 (우선순위 2)
- 개념 사전 페이지 + 역참조 (우선순위 1 완성)

### Phase 3: 기출 모드 (우선순위 3)
- 연도별 기출 모드 + 타이머 + 결과 리뷰

### Phase 4: 학습 도구 (우선순위 4~5)
- 오답노트/북마크 (IndexedDB)
- 통계 대시보드 (Recharts)

### Phase 5: 확장 (우선순위 6 + 콘텐츠)
- 랜덤 모의고사
- 나머지 과목 데이터 입력
- PDF 변환 스크립트 안정화

### Phase 6: 배포 및 PWA 최적화
- Vercel 배포
- PWA 아이콘, manifest, 오프라인 캐시
- Lighthouse 모바일 점수 90+ 목표

---

## 12. 참고 링크

- 국민체육진흥공단 체육지도자연수원: https://sqms.kspo.or.kr
- 과목 출제 기준은 공식 발표 자료를 우선 참고

---

## 13. 마스터 개인 메모

- 이 프로젝트는 Indilabs 내부용, 공개 배포 계획 없음 (1차)
- 나중에 사주 콘텐츠처럼 영어 버전으로 확장 가능성 검토 (자격증이 다르므로 낮음)
- 자격증 취득 후 실전 활용 노트도 추후 섹션 추가 고려
