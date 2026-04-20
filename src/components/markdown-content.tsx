"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkConcept } from "@/lib/markdown/remark-concept";
import { ConceptLink } from "@/components/concept-link";
import type { Concept } from "@/lib/types";
import { cn } from "@/lib/utils";

type ConceptLinkElementProps = {
  conceptid?: string;
  children?: React.ReactNode;
};

type Props = {
  source: string;
  conceptsById: Record<string, Concept>;
  /** true면 ConceptLink 클릭 시 중첩 드로어를 열지 않고 텍스트로만 표시 */
  inlineOnly?: boolean;
  className?: string;
};

/**
 * 해설·개념 상세 본문에 쓰이는 마크다운 렌더러.
 * {{concept:xxx}} 태그는 remarkConcept 플러그인이 <concept-link>로 변환하고,
 * 여기서 ConceptLink 컴포넌트로 매핑한다.
 */
export function MarkdownContent({
  source,
  conceptsById,
  inlineOnly = false,
  className,
}: Props) {
  const components: Components = {
    h1: ({ children }) => (
      <h2 className="mt-4 text-lg font-semibold first:mt-0">{children}</h2>
    ),
    h2: ({ children }) => (
      <h3 className="mt-4 text-base font-semibold first:mt-0">{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className="mt-3 text-sm font-semibold first:mt-0">{children}</h4>
    ),
    p: ({ children }) => (
      <p className="mt-2 text-[15px] leading-7 first:mt-0">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mt-2 list-disc pl-5 text-[15px] leading-7">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mt-2 list-decimal pl-5 text-[15px] leading-7">{children}</ol>
    ),
    li: ({ children }) => <li className="mt-1">{children}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    table: ({ children }) => (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
    th: ({ children }) => (
      <th className="border border-border px-3 py-2 text-left font-medium">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border px-3 py-2">{children}</td>
    ),
    // remarkConcept가 만든 <concept-link>
    // react-markdown components 타입은 표준 HTML 요소 중심이라 캐스팅이 필요하다.
    ...({
      "concept-link": ({ conceptid }: ConceptLinkElementProps) => {
        const id = conceptid ?? "";
        const concept = conceptsById[id];
        if (!concept) {
          return (
            <span className="text-destructive" title={`미존재 개념: ${id}`}>
              [{id}]
            </span>
          );
        }
        return (
          <ConceptLink
            concept={concept}
            conceptsById={conceptsById}
            inlineOnly={inlineOnly}
          />
        );
      },
    } as Components),
  };

  return (
    <div className={cn("text-[15px] leading-7 text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkConcept]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
