"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Flag,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExplanationPanel } from "@/components/explanation-panel";
import { cn } from "@/lib/utils";
import type { Concept, Question, Subject } from "@/lib/types";

export type SessionCompletion = {
  questions: Question[];
  answers: Record<string, number>;
  startedAt: number;
  endedAt: number;
  timedOut: boolean;
};

export type ExamSessionProps = {
  questions: Question[];
  conceptsById: Record<string, Concept>;
  timerMinutes: number | null;
  title: string;
  subtitleAccent?: { color: string; icon: string } | null;
  backHref: Route;
  showPassIndicator?: boolean;
  subjectsById?: Record<string, Subject>;
  onComplete?: (c: SessionCompletion) => void;
  onExit: () => void;
};

type Phase = "active" | "done";

export function ExamSession({
  questions,
  conceptsById,
  timerMinutes,
  title,
  subtitleAccent,
  backHref,
  showPassIndicator = true,
  subjectsById,
  onComplete,
  onExit,
}: ExamSessionProps) {
  const [phase, setPhase] = useState<Phase>("active");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [cursor, setCursor] = useState(0);
  const [startedAt] = useState<number>(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(
    timerMinutes !== null ? timerMinutes * 60 * 1000 : null
  );
  const [showAllReview, setShowAllReview] = useState(false);

  const total = questions.length;
  const current = questions[cursor];

  function submit(): void {
    const finishedAt = Date.now();
    setEndedAt(finishedAt);
    setPhase("done");
    onComplete?.({
      questions,
      answers,
      startedAt,
      endedAt: finishedAt,
      timedOut: timerMinutes !== null && (remainingMs ?? 0) <= 0,
    });
  }

  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (phase !== "active" || timerMinutes === null) return;
    const id = window.setInterval(() => {
      setRemainingMs((prev) => {
        if (prev === null) return prev;
        const next = prev - 1000;
        if (next <= 0) {
          window.clearInterval(id);
          submitRef.current();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, timerMinutes]);

  function handleChoose(index: number): void {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: index }));
  }

  if (phase === "done") {
    return (
      <ResultScreen
        title={title}
        questions={questions}
        answers={answers}
        conceptsById={conceptsById}
        subjectsById={subjectsById}
        startedAt={startedAt}
        endedAt={endedAt}
        timedOut={timerMinutes !== null && remainingMs === 0}
        showAll={showAllReview}
        onToggleShowAll={() => setShowAllReview((v) => !v)}
        onRestart={onExit}
        backHref={backHref}
        showPassIndicator={showPassIndicator}
      />
    );
  }

  if (!current) return null;
  const answered = answers[current.id];
  const solvedCount = Object.keys(answers).length;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <header className="flex items-center gap-2">
        {subtitleAccent ? (
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-md text-lg"
            style={{
              backgroundColor: `${subtitleAccent.color}22`,
              color: subtitleAccent.color,
            }}
            aria-hidden
          >
            {subtitleAccent.icon}
          </span>
        ) : null}
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {cursor + 1} / {total} · 푼 문항 {solvedCount}
          </p>
        </div>
        {remainingMs !== null && <TimerBadge remainingMs={remainingMs} />}
      </header>

      <NumberPalette
        total={total}
        cursor={cursor}
        answered={answers}
        questions={questions}
        onJump={setCursor}
      />

      <SessionQuestionCard
        question={current}
        chosen={answered ?? null}
        onChoose={handleChoose}
      />

      <div className="sticky bottom-20 mt-2 flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => setCursor((c) => Math.max(0, c - 1))}
          disabled={cursor === 0}
        >
          <ArrowLeft className="h-4 w-4" />
          이전
        </Button>
        {cursor < total - 1 ? (
          <Button
            size="lg"
            className="flex-1"
            onClick={() => setCursor((c) => Math.min(total - 1, c + 1))}
          >
            다음
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={submit}>
            <Flag className="h-4 w-4" />
            제출
          </Button>
        )}
      </div>

      {cursor === total - 1 ? null : (
        <button
          type="button"
          onClick={submit}
          className="mx-auto mt-1 text-xs text-muted-foreground underline"
        >
          중간 제출하기
        </button>
      )}
    </div>
  );
}

function TimerBadge({ remainingMs }: { remainingMs: number }) {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const warn = totalSec <= 5 * 60;
  return (
    <span
      className={cn(
        "flex flex-none items-center gap-1 rounded-md border px-2 py-1 text-xs font-mono tabular-nums",
        warn
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-card text-foreground"
      )}
      aria-label={`남은 시간 ${m}분 ${s}초`}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

function NumberPalette({
  total,
  cursor,
  answered,
  questions,
  onJump,
}: {
  total: number;
  cursor: number;
  answered: Record<string, number>;
  questions: Question[];
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const q = questions[i];
        const isAnswered = q ? answered[q.id] !== undefined : false;
        const isActive = i === cursor;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold",
              isActive && "ring-2 ring-primary",
              isAnswered
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            )}
            aria-current={isActive ? "true" : undefined}
            aria-label={`${i + 1}번 문항${isAnswered ? " (응답 완료)" : ""}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function SessionQuestionCard({
  question,
  chosen,
  onChoose,
}: {
  question: Question;
  chosen: number | null;
  onChoose: (i: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">#{question.number}</Badge>
          {question.difficulty && (
            <Badge variant="outline">
              {question.difficulty === "easy"
                ? "쉬움"
                : question.difficulty === "mid"
                  ? "보통"
                  : "어려움"}
            </Badge>
          )}
        </div>
        <p className="text-[17px] font-medium leading-relaxed">
          {question.question}
        </p>
        <ul className="mt-1 flex flex-col gap-2">
          {question.choices.map((choice, i) => {
            const isChosen = i === chosen;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onChoose(i)}
                  aria-pressed={isChosen}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-[15px] leading-relaxed transition-colors min-h-[56px]",
                    isChosen
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border text-xs font-semibold",
                      isChosen
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    )}
                    aria-hidden
                  >
                    {String.fromCharCode(9312 + i)}
                  </span>
                  <span className="flex-1">{choice}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ResultScreen({
  title,
  questions,
  answers,
  conceptsById,
  subjectsById,
  startedAt,
  endedAt,
  timedOut,
  showAll,
  onToggleShowAll,
  onRestart,
  backHref,
  showPassIndicator,
}: {
  title: string;
  questions: Question[];
  answers: Record<string, number>;
  conceptsById: Record<string, Concept>;
  subjectsById?: Record<string, Subject>;
  startedAt: number;
  endedAt: number | null;
  timedOut: boolean;
  showAll: boolean;
  onToggleShowAll: () => void;
  onRestart: () => void;
  backHref: Route;
  showPassIndicator: boolean;
}) {
  const total = questions.length;

  const { correctCount, unansweredCount } = useMemo(() => {
    let correct = 0;
    let unanswered = 0;
    for (const q of questions) {
      const a = answers[q.id];
      if (a === undefined) unanswered += 1;
      else if (a === q.answer) correct += 1;
    }
    return { correctCount: correct, unansweredCount: unanswered };
  }, [questions, answers]);

  const wrongQuestions = useMemo(
    () =>
      questions.filter((q) => {
        const a = answers[q.id];
        return a === undefined || a !== q.answer;
      }),
    [questions, answers]
  );

  const subjectBreakdown = useMemo(() => {
    if (!subjectsById) return [];
    const bucket = new Map<string, { total: number; correct: number }>();
    for (const q of questions) {
      const cur = bucket.get(q.subjectId) ?? { total: 0, correct: 0 };
      cur.total += 1;
      const a = answers[q.id];
      if (a !== undefined && a === q.answer) cur.correct += 1;
      bucket.set(q.subjectId, cur);
    }
    return Array.from(bucket.entries())
      .map(([id, v]) => {
        const s = subjectsById[id];
        return {
          id,
          name: s?.shortName ?? s?.name ?? id,
          color: s?.color ?? "#6366F1",
          total: v.total,
          correct: v.correct,
          percent: v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [questions, answers, subjectsById]);

  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = percent >= 40;
  const elapsedMs = endedAt !== null ? endedAt - startedAt : null;
  const reviewList = showAll ? questions : wrongQuestions;

  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      <div className="flex items-center gap-2 px-2">
        <Link
          href={backHref}
          aria-label="돌아가기"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">{title} 결과</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
          {showPassIndicator && (
            <div className="flex items-center gap-2">
              {passed ? (
                <CheckCircle2
                  className="h-6 w-6 text-[hsl(var(--success))]"
                  aria-hidden
                />
              ) : (
                <XCircle className="h-6 w-6 text-destructive" aria-hidden />
              )}
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {passed ? "과락 통과 기준 (40%) 이상" : "40% 미만"}
              </span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tabular-nums">{percent}</span>
            <span className="text-lg text-muted-foreground">점</span>
          </div>
          <div className="text-sm text-muted-foreground">
            정답 {correctCount} / {total}
            {unansweredCount > 0 ? ` · 미응답 ${unansweredCount}` : ""}
          </div>
          {elapsedMs !== null && (
            <div className="text-xs text-muted-foreground">
              소요 시간 {formatDuration(elapsedMs)}
              {timedOut ? " · 시간 종료" : ""}
            </div>
          )}
        </CardContent>
      </Card>

      {subjectBreakdown.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">과목별 결과</h2>
            <ul className="flex flex-col gap-2">
              {subjectBreakdown.map((s) => (
                <li key={s.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.correct}/{s.total} · {s.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.percent}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onToggleShowAll}
        >
          {showAll ? "오답만 보기" : `전체 보기 (${total})`}
        </Button>
        <Button size="lg" className="flex-1" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" />
          다시 풀기
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="px-2 text-sm font-semibold text-muted-foreground">
          {showAll ? "전체 문항 리뷰" : "오답 리뷰"}
          <span className="ml-1.5 text-xs font-normal">
            ({reviewList.length})
          </span>
        </h2>
        {reviewList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            모두 정답입니다.
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {reviewList.map((q) => {
              const a = answers[q.id];
              return (
                <li
                  key={q.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">#{q.number}</Badge>
                    {a === undefined ? (
                      <Badge variant="outline">미응답</Badge>
                    ) : a === q.answer ? (
                      <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-transparent">
                        정답
                      </Badge>
                    ) : (
                      <Badge variant="destructive">오답</Badge>
                    )}
                  </div>
                  <p className="text-[15px] font-medium leading-relaxed">
                    {q.question}
                  </p>
                  <ol className="flex flex-col gap-1 text-sm">
                    {q.choices.map((c, i) => {
                      const isAnswer = i === q.answer;
                      const isChosen = i === a;
                      return (
                        <li
                          key={i}
                          className={cn(
                            "flex items-start gap-2 rounded-md border px-3 py-2",
                            isAnswer &&
                              "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10",
                            !isAnswer &&
                              isChosen &&
                              "border-destructive bg-destructive/10",
                            !isAnswer &&
                              !isChosen &&
                              "border-border/60 opacity-70"
                          )}
                        >
                          <span className="font-semibold">
                            {String.fromCharCode(9312 + i)}
                          </span>
                          <span className="flex-1">{c}</span>
                        </li>
                      );
                    })}
                  </ol>
                  <ExplanationPanel
                    question={q}
                    chosen={a ?? -1}
                    conceptsById={conceptsById}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}
