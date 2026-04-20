# CONCEPT_LINKING.md — 개념 연계 시스템 설계

이 프로젝트의 **가장 중요한 차별점**. 단순 문제은행이 아니라 **개념 기반 네트워크 학습 도구**로 만드는 핵심 구조.

---

## 1. 철학

체육지도자 시험은 단순 암기가 아니라 **개념 간 연결**을 요구한다.
예: "운동학습"을 알려면 "운동제어", "피드백", "주의자원"을 함께 이해해야 한다.

기존 문제집은 문제→해설→끝. 이 사이트는 **문제→해설→개념→관련 문제들→관련 개념들→...** 로 이어지는 학습을 유도한다.

---

## 2. 핵심 구성요소

### 2.1 개념 사전 (`concepts.json`)
- 모든 핵심 개념을 ID로 카탈로그화
- 정의 + 상세 + 관련 개념 + 키워드

### 2.2 태그 문법
해설(`explanation`)과 개념 상세(`details`) 안에서 사용.

```markdown
Fitts와 Posner의 {{concept:stages-of-motor-learning}}는 3단계로 구성된다.
```

렌더링 시 `{{concept:stages-of-motor-learning}}`는 클릭 가능한 링크로 변환.
링크 텍스트는 해당 concept의 `name` 필드.

### 2.3 역참조 (Backlinks)
개념 상세 페이지 하단에 **"이 개념이 나온 문제"** 섹션 자동 생성.
빌드 시 또는 런타임에 `questions/*.json`을 스캔해 `conceptIds` 포함 문제 목록 수집.

### 2.4 관련 개념 그래프
`Concept.relatedConceptIds`로 양방향 그래프 구성.
개념 상세 페이지에 **"관련 개념"** 섹션으로 표시.

---

## 3. UI 동작 명세

### 3.1 문제 풀이 화면 → 해설
- 해설 안 `<ConceptLink>`를 **탭**하면 **바텀시트 모달**로 개념 상세 표시
- 모달 상단: 개념명 + 정의
- 모달 중단: 상세 (마크다운 렌더)
- 모달 하단: 관련 개념 칩 + "전체 개념 페이지 열기" 버튼
- 페이지 전환 없이 진행 중인 문제 풀이 유지

### 3.2 개념 사전 페이지 (`/concepts/[slug]`)
- 전체 정의 및 상세
- 관련 개념 리스트 (카드)
- 이 개념이 등장한 문제 리스트 (연도·과목 태그와 함께)
- 각 문제 카드 탭 → 해당 문제로 이동

### 3.3 개념 인덱스 (`/concepts`)
- 과목별 탭
- 중요도(`importance`) 순 정렬 기본
- 검색 바 (name + keywords 매칭)

---

## 4. 렌더링 구현

### 4.1 ConceptLink 컴포넌트

```tsx
// src/components/ConceptLink.tsx
interface Props {
  conceptId: string;
  children?: React.ReactNode;  // 커스텀 텍스트 (없으면 concept.name)
}

export function ConceptLink({ conceptId, children }: Props) {
  const concept = useConcept(conceptId);
  const [open, setOpen] = useState(false);

  if (!concept) {
    return <span className="text-red-500">[{conceptId}]</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-purple-600 dark:text-purple-400 underline decoration-dotted underline-offset-2"
      >
        {children ?? concept.name}
      </button>
      <ConceptSheet
        concept={concept}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
```

### 4.2 마크다운 렌더러

`react-markdown` + 커스텀 remark plugin으로 `{{concept:xxx}}`를 처리.

```typescript
// src/lib/remark-concept.ts
export function remarkConcept() {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      const regex = /\{\{concept:([a-z0-9-]+)\}\}/g;
      // 매칭 부분을 커스텀 MDX 노드로 치환
      // 렌더 시 <ConceptLink conceptId={id} /> 로 렌더링
    });
  };
}
```

---

## 5. 데이터 품질 규칙

### 5.1 개념 작성 기준
- **정의(definition)**: 한 줄, 50자 이내
- **상세(details)**: 200~500자, 마크다운 허용
- **중요도**: 자주 출제되는 개념 = 3, 배경 지식 = 1
- 모든 개념은 **최소 1개 이상의 관련 개념** 가져야 함

### 5.2 해설 작성 기준
- **250~400자** (모바일 가독성)
- **핵심 용어 2~4개를 반드시 `{{concept:...}}`로 태깅**
- 근거/출처 있으면 말미에 괄호로 표기 예: `(Fitts & Posner, 1967)`
- em dash(—) 금지 → 콤마, 마침표, 괄호 사용

### 5.3 conceptIds 필드
- 해설 안 `{{concept:...}}` 태그의 전체 집합과 **동일해야 함**
- validator가 불일치 시 에러 발생

---

## 6. 확장 아이디어 (추후)

- **개념 그래프 시각화**: D3.js로 개념 네트워크 맵
- **학습 경로 추천**: 취약 개념에서 시작해 관련 개념으로 확장하는 로드맵
- **플래시카드 모드**: 개념 정의만 보고 맞추기
- **AI 튜터**: 개념 페이지에서 "더 쉽게 설명해줘" 버튼 (Claude API)
