"use client";

import { useState } from "react";
import type { Concept } from "@/lib/types";
import { ConceptSheet } from "@/components/concept-sheet";

type Props = {
  concept: Concept;
  conceptsById: Record<string, Concept>;
  /** 이미 드로어 안에 있을 때는 중첩 열지 않고 비활성 링크로 표시 */
  inlineOnly?: boolean;
};

export function ConceptLink({ concept, conceptsById, inlineOnly }: Props) {
  const [open, setOpen] = useState(false);

  if (inlineOnly) {
    return (
      <span className="font-medium text-primary underline decoration-dotted underline-offset-2">
        {concept.name}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-medium text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
      >
        {concept.name}
      </button>
      <ConceptSheet
        concept={concept}
        conceptsById={conceptsById}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
