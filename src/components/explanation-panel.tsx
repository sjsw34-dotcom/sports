"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/markdown-content";
import { cn } from "@/lib/utils";
import type { Concept, Question } from "@/lib/types";

type Props = {
  question: Question;
  chosen: number;
  conceptsById: Record<string, Concept>;
};

export function ExplanationPanel({ question, chosen, conceptsById }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isCorrect = chosen === question.answer;
  const hasEnhanced = Boolean(question.enhancedExplanation);

  const concepts = question.conceptIds
    .map((id) => conceptsById[id])
    .filter((c): c is Concept => Boolean(c));

  return (
    <section
      className={cn(
        "rounded-lg border p-4",
        isCorrect
          ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5"
          : "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "text-sm font-semibold",
            isCorrect ? "text-[hsl(var(--success))]" : "text-destructive"
          )}
        >
          {isCorrect ? "정답입니다" : "오답입니다"}
        </span>
        <span className="text-xs text-muted-foreground">
          정답: {String.fromCharCode(9312 + question.answer)}
        </span>
      </div>

      <MarkdownContent
        source={question.explanation}
        conceptsById={conceptsById}
      />

      {hasEnhanced && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            심화 해설 {expanded ? "접기" : "열기"}
          </button>
          {expanded && question.enhancedExplanation && (
            <div className="mt-2 rounded-md bg-background/50 p-3">
              <MarkdownContent
                source={question.enhancedExplanation}
                conceptsById={conceptsById}
              />
            </div>
          )}
        </div>
      )}

      {concepts.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            관련 개념
          </div>
          <div className="flex flex-wrap gap-1.5">
            {concepts.map((c) => (
              <Badge key={c.id} variant="outline">
                {c.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
