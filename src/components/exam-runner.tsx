"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExamSession, type SessionCompletion } from "@/components/exam-session";
import { recordAttempt } from "@/lib/db-hooks";
import { getDB } from "@/lib/db";
import type { Concept, Question, Subject } from "@/lib/types";

type Props = {
  subject: Subject;
  year: number;
  questions: Question[];
  conceptsById: Record<string, Concept>;
};

type Phase = "setup" | "running";
const DEFAULT_MINUTES = 100;

export function ExamRunner({ subject, year, questions, conceptsById }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(DEFAULT_MINUTES);
  const [sessionKey, setSessionKey] = useState(0);

  if (questions.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          이 연도의 문제가 아직 없습니다.
        </p>
        <Link
          href="/years"
          className="mt-4 inline-block text-sm text-primary underline"
        >
          연도 목록으로
        </Link>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <SetupScreen
        subject={subject}
        year={year}
        total={questions.length}
        timerEnabled={timerEnabled}
        onToggleTimer={setTimerEnabled}
        timerMinutes={timerMinutes}
        onChangeMinutes={setTimerMinutes}
        onStart={() => setPhase("running")}
      />
    );
  }

  return (
    <ExamSession
      key={sessionKey}
      questions={questions}
      conceptsById={conceptsById}
      timerMinutes={timerEnabled ? timerMinutes : null}
      title={`${year} ${subject.name}`}
      subtitleAccent={{ color: subject.color, icon: subject.icon }}
      backHref="/years"
      showPassIndicator
      onComplete={(c) => {
        void persistSession({ ...c, subject, year });
      }}
      onExit={() => {
        setSessionKey((k) => k + 1);
        setPhase("setup");
      }}
    />
  );
}

function SetupScreen({
  subject,
  year,
  total,
  timerEnabled,
  onToggleTimer,
  timerMinutes,
  onChangeMinutes,
  onStart,
}: {
  subject: Subject;
  year: number;
  total: number;
  timerEnabled: boolean;
  onToggleTimer: (v: boolean) => void;
  timerMinutes: number;
  onChangeMinutes: (v: number) => void;
  onStart: () => void;
}) {
  const presets = [60, 100, 120];

  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      <div className="flex items-center gap-2 px-2">
        <Link
          href="/years"
          aria-label="연도 목록으로"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">시험 시작 준비</h1>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <span
            className="flex h-12 w-12 flex-none items-center justify-center rounded-lg text-2xl"
            style={{ backgroundColor: `${subject.color}22`, color: subject.color }}
            aria-hidden
          >
            {subject.icon}
          </span>
          <div className="flex-1">
            <div className="text-lg font-semibold">{subject.name}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{year} 세트</Badge>
              <span>{total}문항</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={timerEnabled}
            onChange={(e) => onToggleTimer(e.target.checked)}
            className="mt-1 h-5 w-5 flex-none accent-primary"
            aria-label="타이머 사용"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-sm font-semibold">타이머 사용</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              체크하면 제한 시간 안에 풀어야 합니다. 끄면 편하게 연습 가능.
            </p>
          </div>
        </label>

        {timerEnabled && (
          <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">
            <div className="text-xs font-semibold text-muted-foreground">
              제한 시간 (분)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((m) => (
                <Badge
                  key={m}
                  role="button"
                  tabIndex={0}
                  onClick={() => onChangeMinutes(m)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onChangeMinutes(m);
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
                  if (Number.isFinite(v) && v > 0) onChangeMinutes(v);
                }}
                className="h-7 w-20 rounded-md border border-border bg-background px-2 text-sm"
                aria-label="제한 시간 직접 입력"
              />
            </div>
          </div>
        )}
      </div>

      <Button size="lg" onClick={onStart} className="w-full">
        시작하기
      </Button>
    </section>
  );
}

async function persistSession(
  args: SessionCompletion & { subject: Subject; year: number }
): Promise<void> {
  const { questions, answers, startedAt, endedAt, subject, year } = args;
  const startIso = new Date(startedAt).toISOString();
  const endIso = new Date(endedAt).toISOString();

  let correctCount = 0;
  for (const q of questions) {
    const chosen = answers[q.id];
    if (chosen === undefined) continue;
    const isCorrect = chosen === q.answer;
    if (isCorrect) correctCount += 1;
    await recordAttempt({
      questionId: q.id,
      subjectId: q.subjectId,
      chosenAnswer: chosen,
      isCorrect,
      attemptedAt: endIso,
    });
  }

  await getDB().sessions.add({
    subjectId: subject.id,
    year,
    startedAt: startIso,
    finishedAt: endIso,
    totalQuestions: questions.length,
    correctCount,
  });
}
