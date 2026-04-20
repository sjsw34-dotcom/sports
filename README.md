# chedo-prep

체육지도자 자격증(생활 2급 / 유소년 / 노인) 필기시험 대비 모바일 PWA 학습 사이트.

## Claude Code에게 처음 지시하는 방법

이 프로젝트는 **Claude Code로 개발**합니다. 레포 클론 후 Claude Code를 열고 다음을 지시하세요.

### 첫 지시 (Phase 0 부트스트랩)

```
@CLAUDE.md를 읽고 프로젝트를 초기화해줘.

Phase 0만 수행:
1. Next.js 14 (App Router) + TypeScript (strict) + Tailwind + shadcn/ui 설치
2. next-pwa 세팅
3. Dexie.js 설치 + /src/lib/db.ts 스켈레톤 작성
4. 하단 고정 네비게이션 컴포넌트 (홈/과목/기출/오답/통계)
5. 다크 모드 기본값 ThemeProvider 설정
6. /data/subjects.json, /data/certifications.json 빈 배열로 생성
7. /src/lib/types.ts 에 docs/DATA_SCHEMA.md 타입 정의 그대로 옮기기

완료 조건: npm run dev 실행 시 빈 화면에 하단 네비가 뜨면 끝.
```

### 그 다음 지시들 (순서대로)

```
@CLAUDE.md Phase 1 진행:
/data/subjects.json에 9개 과목 데이터를 채우고, 
docs/DATA_SCHEMA.md §3.1 예시 참고해서 타입에 맞게 작성해줘.
그 후 /data/certifications.json도 3개 자격증 채워줘.
```

```
@CLAUDE.md Phase 1 계속:
샘플로 스포츠심리학 2024년 문제 5개를 docs/DATA_SCHEMA.md §3.2 형식으로 
/data/questions/sports-psychology/2024.json에 작성해줘.
해설 안 {{concept:xxx}} 태그도 포함하고, 해당 개념들도 
/data/concepts.json에 추가해줘.
```

```
@CLAUDE.md @docs/CONCEPT_LINKING.md 참고해서 Phase 2 진행:
1. <QuestionCard> 컴포넌트
2. <ExplanationPanel> 컴포넌트  
3. <ConceptLink> 컴포넌트 + 바텀시트
4. react-markdown + remarkConcept 플러그인
5. /subjects/[subject] 라우트에서 위 컴포넌트로 문제풀이 화면 구현

@docs/UX_PRINCIPLES.md 의 모바일 UX 원칙 반드시 지킬 것.
```

이런 식으로 CLAUDE.md의 Phase 로드맵을 따라가며 지시하세요.

## 빠른 시작 (로컬)

```bash
npm install
npm run dev
# http://localhost:3000
```

## 문서

- [CLAUDE.md](./CLAUDE.md) — 프로젝트 헌법
- [docs/DATA_SCHEMA.md](./docs/DATA_SCHEMA.md) — 데이터 구조
- [docs/CONCEPT_LINKING.md](./docs/CONCEPT_LINKING.md) — 개념 연계 설계
- [docs/UX_PRINCIPLES.md](./docs/UX_PRINCIPLES.md) — 모바일 UX 가이드
- [docs/PDF_PARSING.md](./docs/PDF_PARSING.md) — PDF 기출 → JSON 변환

## 라이선스 / 저작권

- 코드: 개인 사용
- 기출문제 원본: 국민체육진흥공단. 개인 학습용으로만 사용.
