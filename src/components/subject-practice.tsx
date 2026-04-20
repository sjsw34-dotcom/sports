"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionCard } from "@/components/question-card";
import { ExplanationPanel } from "@/components/explanation-panel";
import type { Concept, Question, Subject } from "@/lib/types";

type Props = {
  subject: Subject;
  questions: Question[];
  conceptsById: Record<string, Concept>;
};

function shuffleIndices(n: number, seed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  let s = seed;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const tmp = arr[i] as number;
    arr[i] = arr[j] as number;
    arr[j] = tmp;
  }
  return arr;
}

export function SubjectPractice({ subject, questions, conceptsById }: Props) {
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [reshuffleKey, setReshuffleKey] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const availableYears = useMemo(() => {
    const ys = new Set(questions.map((q) => q.year));
    return Array.from(ys).sort((a, b) => b - a);
  }, [questions]);

  const filtered = useMemo(() => {
    const base =
      yearFilter === "all" ? questions : questions.filter((q) => q.year === yearFilter);
    const order = shuffleIndices(base.length, reshuffleKey + 1);
    return order.map((i) => base[i]).filter((q): q is Question => Boolean(q));
  }, [questions, yearFilter, reshuffleKey]);

  const current = filtered[cursor];
  const total = filtered.length;
  const answered = current ? answers[current.id] ?? null : null;
  const solvedCount = Object.keys(answers).length;
  const correctCount = filtered.reduce((acc, q) => {
    const a = answers[q.id];
    return a === q.answer ? acc + 1 : acc;
  }, 0);

  function handleChoose(index: number): void {
    if (!current) return;
    setAnswers((prev) =>
      prev[current.id] !== undefined ? prev : { ...prev, [current.id]: index }
    );
  }

  function handlePrev(): void {
    setCursor((c) => Math.max(0, c - 1));
  }
  function handleNext(): void {
    setCursor((c) => Math.min(total - 1, c + 1));
  }
  function handleReshuffle(): void {
    setReshuffleKey((k) => k + 1);
    setCursor(0);
    setAnswers({});
  }

  if (total === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          아직 수록된 문제가 없습니다. Phase 5에서 데이터가 채워집니다.
        </p>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <header className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-md text-lg"
          style={{ backgroundColor: `${subject.color}22`, color: subject.color }}
          aria-hidden
        >
          {subject.icon}
        </span>
        <div className="flex-1">
          <h1 className="text-base font-semibold leading-tight">{subject.name}</h1>
          <p className="text-xs text-muted-foreground">
            {cursor + 1} / {total} · 정답 {correctCount}/{solvedCount}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleReshuffle}
          aria-label="다시 섞기"
        >
          <Shuffle className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={yearFilter === "all"}
          onClick={() => {
            setYearFilter("all");
            setCursor(0);
          }}
        >
          전체 연도
        </FilterChip>
        {availableYears.map((y) => (
          <FilterChip
            key={y}
            active={yearFilter === y}
            onClick={() => {
              setYearFilter(y);
              setCursor(0);
            }}
          >
            {y}
          </FilterChip>
        ))}
      </div>

      <QuestionCard question={current} chosen={answered} onChoose={handleChoose} />

      {answered !== null && (
        <ExplanationPanel
          question={current}
          chosen={answered}
          conceptsById={conceptsById}
        />
      )}

      <div className="sticky bottom-20 mt-2 flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={handlePrev}
          disabled={cursor === 0}
        >
          <ArrowLeft className="h-4 w-4" />
          이전
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={handleNext}
          disabled={cursor >= total - 1}
        >
          다음
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Badge
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      variant={active ? "default" : "outline"}
      className="cursor-pointer select-none"
    >
      {children}
    </Badge>
  );
}
