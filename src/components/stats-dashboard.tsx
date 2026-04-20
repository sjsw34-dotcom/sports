"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { useAllAttempts, latestAttemptMap } from "@/lib/db-hooks";
import { cn } from "@/lib/utils";
import type { AttemptRecord, Concept, Question, Subject } from "@/lib/types";

type Props = {
  subjectsById: Record<string, Subject>;
  conceptsById: Record<string, Concept>;
  questionsById: Record<string, Question>;
};

export function StatsDashboard({
  subjectsById,
  conceptsById,
  questionsById,
}: Props) {
  const attempts = useAllAttempts();

  const summary = useMemo(() => {
    if (!attempts) return null;
    return computeSummary(attempts, questionsById, subjectsById, conceptsById);
  }, [attempts, questionsById, subjectsById, conceptsById]);

  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      <header className="px-2 pt-2">
        <h1 className="text-xl font-semibold leading-tight">학습 통계</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          풀이 기록을 바탕으로 약한 영역을 한눈에 확인하세요.
        </p>
      </header>

      {!summary ? (
        <LoadingSkeleton />
      ) : summary.totalAttempts === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SummaryStats summary={summary} />
          <WeekHeatmap days={summary.weekDays} />
          <SubjectAccuracy bars={summary.subjectAccuracy} />
          <WeakConcepts items={summary.weakConcepts} />
        </>
      )}
    </section>
  );
}

type Summary = ReturnType<typeof computeSummary>;

function computeSummary(
  attempts: AttemptRecord[],
  questionsById: Record<string, Question>,
  subjectsById: Record<string, Subject>,
  conceptsById: Record<string, Concept>
) {
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.reduce(
    (acc, a) => (a.isCorrect ? acc + 1 : acc),
    0
  );
  const overallAccuracy =
    totalAttempts === 0 ? 0 : Math.round((correctAttempts / totalAttempts) * 100);

  const latest = latestAttemptMap(attempts);
  const uniqueQuestions = latest.size;

  const subjectBuckets = new Map<
    string,
    { correct: number; total: number }
  >();
  attempts.forEach((a) => {
    const cur = subjectBuckets.get(a.subjectId) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    subjectBuckets.set(a.subjectId, cur);
  });
  const subjectAccuracy = Array.from(subjectBuckets.entries())
    .map(([id, v]) => {
      const subject = subjectsById[id];
      return {
        id,
        name: subject?.shortName ?? subject?.name ?? id,
        color: subject?.color ?? "#6366F1",
        accuracy: Math.round((v.correct / v.total) * 100),
        total: v.total,
      };
    })
    .sort((a, b) => b.total - a.total);

  const conceptBuckets = new Map<
    string,
    { correct: number; total: number }
  >();
  attempts.forEach((a) => {
    const q = questionsById[a.questionId];
    if (!q) return;
    for (const cid of q.conceptIds) {
      const cur = conceptBuckets.get(cid) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (a.isCorrect) cur.correct += 1;
      conceptBuckets.set(cid, cur);
    }
  });
  const weakConcepts = Array.from(conceptBuckets.entries())
    .filter(([, v]) => v.total >= 2)
    .map(([id, v]) => ({
      id,
      name: conceptsById[id]?.name ?? id,
      subjectName:
        subjectsById[conceptsById[id]?.subjectId ?? ""]?.shortName ?? "",
      total: v.total,
      wrong: v.total - v.correct,
      wrongRate: Math.round(((v.total - v.correct) / v.total) * 100),
    }))
    .sort((a, b) => b.wrongRate - a.wrongRate || b.wrong - a.wrong)
    .slice(0, 10);

  const weekDays = buildWeekHeatmap(attempts);

  return {
    totalAttempts,
    correctAttempts,
    overallAccuracy,
    uniqueQuestions,
    subjectAccuracy,
    weakConcepts,
    weekDays,
  };
}

function buildWeekHeatmap(attempts: AttemptRecord[]) {
  const days: Array<{ label: string; date: string; count: number }> = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()] ?? "";
    days.push({ label, date: iso, count: 0 });
  }
  const map = new Map(days.map((d) => [d.date, d]));
  for (const a of attempts) {
    const day = a.attemptedAt.slice(0, 10);
    const entry = map.get(day);
    if (entry) entry.count += 1;
  }
  return days;
}

function SummaryStats({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-2">
      <MiniStat label="총 풀이" value={summary.totalAttempts} />
      <MiniStat label="전체 정답률" value={`${summary.overallAccuracy}%`} />
      <MiniStat label="고유 문항" value={summary.uniqueQuestions} />
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-2 py-3">
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function WeekHeatmap({ days }: { days: Summary["weekDays"] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">최근 7일 풀이 활동</h2>
          <span className="text-xs text-muted-foreground">
            {days.reduce((acc, d) => acc + d.count, 0)}문항
          </span>
        </div>
        <div className="flex items-end justify-between gap-1">
          {days.map((d) => {
            const ratio = d.count / max;
            const bg =
              d.count === 0
                ? "bg-muted"
                : ratio < 0.34
                  ? "bg-primary/30"
                  : ratio < 0.67
                    ? "bg-primary/60"
                    : "bg-primary";
            return (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className={cn(
                    "w-full rounded-sm transition-colors",
                    bg
                  )}
                  style={{
                    height: `${Math.max(8, Math.round(ratio * 60))}px`,
                  }}
                  aria-label={`${d.date}: ${d.count}문항`}
                />
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {d.label}
                </span>
                <span className="text-[10px] font-semibold tabular-nums">
                  {d.count}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SubjectAccuracy({
  bars,
}: {
  bars: Summary["subjectAccuracy"];
}) {
  if (bars.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 text-sm font-semibold">과목별 정답률</h2>
        <div style={{ width: "100%", height: Math.max(160, bars.length * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bars}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                width={56}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--accent))", opacity: 0.2 }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value, _name, entry) => {
                  const total = (entry?.payload as { total?: number })?.total;
                  return [`${value}% (${total ?? 0}회)`, "정답률"];
                }}
              />
              <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                {bars.map((b) => (
                  <Cell key={b.id} fill={b.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function WeakConcepts({ items }: { items: Summary["weakConcepts"] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 text-sm font-semibold">취약 개념 TOP {items.length}</h2>
        <ul className="flex flex-col gap-1.5">
          {items.map((c, idx) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <span className="w-5 flex-none text-right text-xs font-bold tabular-nums text-muted-foreground">
                {idx + 1}
              </span>
              <a
                href={`/concepts/${c.id}`}
                className="flex-1 truncate font-medium hover:underline"
              >
                {c.name}
              </a>
              {c.subjectName && (
                <span className="text-[11px] text-muted-foreground">
                  {c.subjectName}
                </span>
              )}
              <span className="text-xs font-semibold tabular-nums text-destructive">
                {c.wrongRate}%
              </span>
              <span className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">
                {c.wrong}/{c.total}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <p className="text-sm font-semibold">아직 기록이 없어요</p>
        <p className="text-xs text-muted-foreground">
          과목별 모드나 연도별 기출을 풀면 여기에 통계가 쌓입니다.
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-lg border border-border bg-card"
        />
      ))}
    </div>
  );
}
