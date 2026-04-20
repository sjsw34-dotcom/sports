"use client";

import { useMemo, useState } from "react";
import { Bookmark, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionCard } from "@/components/question-card";
import { ExplanationPanel } from "@/components/explanation-panel";
import {
  latestAttemptMap,
  recordAttempt,
  useAllAttempts,
  useAllBookmarks,
} from "@/lib/db-hooks";
import { cn } from "@/lib/utils";
import type { Concept, Question, Subject } from "@/lib/types";

type Props = {
  questions: Question[];
  conceptsById: Record<string, Concept>;
  subjectsById: Record<string, Subject>;
};

type Tab = "wrong" | "bookmark";

export function ReviewPanel({ questions, conceptsById, subjectsById }: Props) {
  const [tab, setTab] = useState<Tab>("wrong");

  const attempts = useAllAttempts();
  const bookmarks = useAllBookmarks();

  const questionsById = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of questions) m.set(q.id, q);
    return m;
  }, [questions]);

  const wrongQuestions = useMemo(() => {
    if (!attempts) return [];
    const latest = latestAttemptMap(attempts);
    const list: Array<{ question: Question; chosen: number }> = [];
    latest.forEach((a, qid) => {
      if (a.isCorrect) return;
      const q = questionsById.get(qid);
      if (q) list.push({ question: q, chosen: a.chosenAnswer });
    });
    list.sort((a, b) => {
      const aa = latest.get(a.question.id)?.attemptedAt ?? "";
      const bb = latest.get(b.question.id)?.attemptedAt ?? "";
      return bb.localeCompare(aa);
    });
    return list;
  }, [attempts, questionsById]);

  const bookmarkedQuestions = useMemo(() => {
    if (!bookmarks) return [];
    return bookmarks
      .map((b) => questionsById.get(b.questionId))
      .filter((q): q is Question => Boolean(q));
  }, [bookmarks, questionsById]);

  const loaded = attempts !== undefined && bookmarks !== undefined;

  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <header className="px-2 pt-2">
        <h1 className="text-xl font-semibold leading-tight">복습 노트</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          틀린 문제와 북마크한 문제를 한 곳에서 다시 풀어보세요.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <TabButton
          active={tab === "wrong"}
          onClick={() => setTab("wrong")}
          icon={<XCircle className="h-4 w-4" />}
          label="오답"
          count={wrongQuestions.length}
        />
        <TabButton
          active={tab === "bookmark"}
          onClick={() => setTab("bookmark")}
          icon={<Bookmark className="h-4 w-4" />}
          label="북마크"
          count={bookmarkedQuestions.length}
        />
      </div>

      {!loaded ? (
        <LoadingState />
      ) : tab === "wrong" ? (
        wrongQuestions.length === 0 ? (
          <EmptyState
            title="아직 오답이 없어요"
            description="문제를 풀어서 기록을 쌓아보세요."
          />
        ) : (
          <ul className="flex flex-col gap-5">
            {wrongQuestions.map(({ question, chosen }) => (
              <li key={question.id}>
                <ReviewQuestionItem
                  question={question}
                  initialChosen={chosen}
                  conceptsById={conceptsById}
                  subject={subjectsById[question.subjectId]}
                />
              </li>
            ))}
          </ul>
        )
      ) : bookmarkedQuestions.length === 0 ? (
        <EmptyState
          title="북마크가 비어있어요"
          description="문제 풀이 화면에서 별 아이콘을 눌러 추가할 수 있습니다."
        />
      ) : (
        <ul className="flex flex-col gap-5">
          {bookmarkedQuestions.map((question) => (
            <li key={question.id}>
              <ReviewQuestionItem
                question={question}
                initialChosen={null}
                conceptsById={conceptsById}
                subject={subjectsById[question.subjectId]}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-[48px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-accent"
      )}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
          active ? "bg-primary/20" : "bg-muted"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ReviewQuestionItem({
  question,
  initialChosen,
  conceptsById,
  subject,
}: {
  question: Question;
  initialChosen: number | null;
  conceptsById: Record<string, Concept>;
  subject: Subject | undefined;
}) {
  const [chosen, setChosen] = useState<number | null>(initialChosen);

  function handleChoose(index: number): void {
    if (chosen !== null) return;
    setChosen(index);
    void recordAttempt({
      questionId: question.id,
      subjectId: question.subjectId,
      chosenAnswer: index,
      isCorrect: index === question.answer,
    });
  }

  function handleReset(): void {
    setChosen(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {subject && (
        <div className="flex items-center gap-2 px-1">
          <span
            className="flex h-6 w-6 items-center justify-center rounded text-sm"
            style={{
              backgroundColor: `${subject.color}22`,
              color: subject.color,
            }}
            aria-hidden
          >
            {subject.icon}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {subject.name}
          </span>
          {chosen !== null && (
            <button
              type="button"
              onClick={handleReset}
              className="ml-auto text-xs text-muted-foreground underline"
            >
              다시 풀기
            </button>
          )}
        </div>
      )}
      <QuestionCard
        question={question}
        chosen={chosen}
        onChoose={handleChoose}
      />
      {chosen !== null && (
        <ExplanationPanel
          question={question}
          chosen={chosen}
          conceptsById={conceptsById}
        />
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-lg border border-border bg-card"
        />
      ))}
    </div>
  );
}

