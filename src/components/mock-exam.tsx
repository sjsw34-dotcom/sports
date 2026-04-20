"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Clock, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExamSession, type SessionCompletion } from "@/components/exam-session";
import { recordAttempt } from "@/lib/db-hooks";
import { cn } from "@/lib/utils";
import type { Concept, Question, Subject, SubjectId } from "@/lib/types";

type Props = {
  subjects: Subject[];
  questions: Question[];
  conceptsById: Record<string, Concept>;
};

type Phase = "setup" | "running";

const COUNT_PRESETS = [10, 20, 50, 100];
const MINUTE_PRESETS = [15, 30, 60];
const DEFAULT_COUNT = 20;
const DEFAULT_MINUTES = 30;

export function MockExam({ subjects, questions, conceptsById }: Props) {
  const availableSubjects = useMemo(() => {
    const ids = new Set(questions.map((q) => q.subjectId));
    return subjects.filter((s) => ids.has(s.id));
  }, [subjects, questions]);

  const [selected, setSelected] = useState<Set<SubjectId>>(
    () => new Set(availableSubjects.map((s) => s.id))
  );
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [weighted, setWeighted] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(DEFAULT_MINUTES);
  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [sessionKey, setSessionKey] = useState(0);

  const subjectsById = useMemo<Record<string, Subject>>(
    () => Object.fromEntries(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const pool = useMemo(
    () => questions.filter((q) => selected.has(q.subjectId)),
    [questions, selected]
  );

  const maxCount = pool.length;
  const effectiveCount = Math.min(count, maxCount);

  function toggleSubject(id: SubjectId): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(): void {
    setSelected(new Set(availableSubjects.map((s) => s.id)));
  }
  function selectNone(): void {
    setSelected(new Set());
  }

  function start(): void {
    if (pool.length === 0) return;
    const picked = pickQuestions(pool, effectiveCount, weighted);
    const renumbered = picked.map((q, i) => ({ ...q, number: i + 1 }));
    setSessionQuestions(renumbered);
    setPhase("running");
  }

  function exit(): void {
    setSessionKey((k) => k + 1);
    setPhase("setup");
  }

  if (phase === "running") {
    return (
      <ExamSession
        key={sessionKey}
        questions={sessionQuestions}
        conceptsById={conceptsById}
        timerMinutes={timerEnabled ? timerMinutes : null}
        title={`모의고사 ${sessionQuestions.length}문항`}
        backHref="/mock"
        showPassIndicator={false}
        subjectsById={subjectsById}
        onComplete={(c) => {
          void persistAttempts(c);
        }}
        onExit={exit}
      />
    );
  }

  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      <div className="flex items-center gap-2 px-2">
        <Link
          href="/"
          aria-label="홈으로"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-base font-semibold">모의고사 만들기</h1>
          <p className="text-xs text-muted-foreground">
            과목을 골라 원하는 수만큼 랜덤으로 뽑습니다.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">과목 선택</h2>
            <div className="flex gap-1.5 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-md border border-border px-2 py-1 hover:bg-accent"
              >
                전체
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="rounded-md border border-border px-2 py-1 hover:bg-accent"
              >
                해제
              </button>
            </div>
          </div>
          {availableSubjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              문제 데이터가 있는 과목이 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {availableSubjects.map((s) => {
                const count = questions.filter(
                  (q) => q.subjectId === s.id
                ).length;
                const checked = selected.has(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
                        checked
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-card hover:bg-accent"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSubject(s.id)}
                        className="h-4 w-4 flex-none accent-primary"
                      />
                      <span
                        className="flex h-8 w-8 flex-none items-center justify-center rounded text-base"
                        style={{
                          backgroundColor: `${s.color}22`,
                          color: s.color,
                        }}
                        aria-hidden
                      >
                        {s.icon}
                      </span>
                      <span className="flex-1 text-sm font-medium">
                        {s.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {count}문항
                      </Badge>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">문항 수</h2>
            <span className="text-xs text-muted-foreground">
              풀 수 있는 최대 {maxCount}문항
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COUNT_PRESETS.map((n) => (
              <Badge
                key={n}
                role="button"
                tabIndex={0}
                onClick={() => setCount(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setCount(n);
                  }
                }}
                variant={count === n ? "default" : "outline"}
                className="cursor-pointer select-none"
              >
                {n}문항
              </Badge>
            ))}
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) setCount(v);
              }}
              className="h-7 w-20 rounded-md border border-border bg-background px-2 text-sm"
              aria-label="문항 수 직접 입력"
            />
          </div>
          <label className="mt-1 flex cursor-pointer items-start gap-3 border-t border-border/60 pt-3">
            <input
              type="checkbox"
              checked={weighted}
              onChange={(e) => setWeighted(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-none accent-primary"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold">
                자주 등장한 개념 가중치
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                개념에 엮인 문제가 많을수록 높은 확률로 뽑힙니다.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={timerEnabled}
            onChange={(e) => setTimerEnabled(e.target.checked)}
            className="mt-1 h-5 w-5 flex-none accent-primary"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-sm font-semibold">타이머 사용</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              제한 시간 안에 푸는 연습이 필요할 때만 체크하세요.
            </p>
          </div>
        </label>

        {timerEnabled && (
          <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">
            <div className="text-xs font-semibold text-muted-foreground">
              제한 시간 (분)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MINUTE_PRESETS.map((m) => (
                <Badge
                  key={m}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTimerMinutes(m)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setTimerMinutes(m);
                    }
                  }}
                  variant={timerMinutes === m ? "default" : "outline"}
                  className="cursor-pointer select-none"
                >
                  {m}분
                </Badge>
              ))}
              <input
                type="number"
                min={1}
                max={600}
                value={timerMinutes}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) setTimerMinutes(v);
                }}
                className="h-7 w-20 rounded-md border border-border bg-background px-2 text-sm"
                aria-label="제한 시간 직접 입력"
              />
            </div>
          </div>
        )}
      </div>

      <Button
        size="lg"
        onClick={start}
        disabled={pool.length === 0 || effectiveCount === 0}
        className="w-full"
      >
        <Shuffle className="h-4 w-4" />
        {effectiveCount}문항 시작하기
      </Button>
    </section>
  );
}

function pickQuestions(
  pool: Question[],
  count: number,
  weighted: boolean
): Question[] {
  if (count >= pool.length) {
    return shuffle(pool.slice());
  }
  if (!weighted) {
    return shuffle(pool.slice()).slice(0, count);
  }

  const conceptFreq = new Map<string, number>();
  for (const q of pool) {
    for (const c of q.conceptIds) {
      conceptFreq.set(c, (conceptFreq.get(c) ?? 0) + 1);
    }
  }
  const weights = pool.map((q) => {
    const w = q.conceptIds.reduce(
      (acc, c) => acc + (conceptFreq.get(c) ?? 0),
      1
    );
    return w;
  });

  const picked: Question[] = [];
  const remaining = pool.slice();
  const remainingWeights = weights.slice();

  while (picked.length < count && remaining.length > 0) {
    const total = remainingWeights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < remaining.length; idx++) {
      r -= remainingWeights[idx] ?? 0;
      if (r <= 0) break;
    }
    if (idx >= remaining.length) idx = remaining.length - 1;
    const [q] = remaining.splice(idx, 1);
    remainingWeights.splice(idx, 1);
    if (q) picked.push(q);
  }
  return picked;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

async function persistAttempts(c: SessionCompletion): Promise<void> {
  const endIso = new Date(c.endedAt).toISOString();
  for (const q of c.questions) {
    const chosen = c.answers[q.id];
    if (chosen === undefined) continue;
    await recordAttempt({
      questionId: q.id,
      subjectId: q.subjectId,
      chosenAnswer: chosen,
      isCorrect: chosen === q.answer,
      attemptedAt: endIso,
    });
  }
}
