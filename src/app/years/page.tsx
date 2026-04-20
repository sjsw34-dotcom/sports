import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadExamSets, loadSubjects } from "@/lib/data-loader";
import type { Subject } from "@/lib/types";

export default function YearsIndexPage() {
  const sets = loadExamSets();
  const subjectsById: Record<string, Subject> = Object.fromEntries(
    loadSubjects().map((s) => [s.id, s])
  );

  const byYear = new Map<number, typeof sets>();
  for (const s of sets) {
    const list = byYear.get(s.year) ?? [];
    list.push(s);
    byYear.set(s.year, list);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      <header className="px-2 pt-2">
        <h1 className="text-xl font-semibold leading-tight">연도별 기출</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          실제 시험 형식으로 풀어보세요. 타이머는 선택 사항입니다.
        </p>
      </header>

      {sets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            아직 수록된 기출이 없습니다.
          </p>
        </div>
      ) : (
        years.map((year) => {
          const items = byYear.get(year) ?? [];
          return (
            <div key={year} className="flex flex-col gap-2">
              <h2 className="px-2 text-sm font-semibold text-muted-foreground">
                {year}년도
              </h2>
              <ul className="grid gap-2">
                {items.map((s) => {
                  const subject = subjectsById[s.subjectId];
                  if (!subject) return null;
                  return (
                    <li key={`${s.year}-${s.subjectId}`}>
                      <Link
                        href={`/years/${s.year}/${s.subjectId}`}
                        className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <Card className="transition-colors hover:bg-accent">
                          <CardContent className="flex items-center gap-3 p-4">
                            <span
                              className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-xl"
                              style={{
                                backgroundColor: `${subject.color}22`,
                                color: subject.color,
                              }}
                              aria-hidden
                            >
                              {subject.icon}
                            </span>
                            <div className="flex-1">
                              <div className="text-base font-semibold">
                                {subject.name}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                  {s.count}문항
                                </Badge>
                                <span>{s.year} 세트</span>
                              </div>
                            </div>
                            <ChevronRight
                              className="h-5 w-5 flex-none text-muted-foreground"
                              aria-hidden
                            />
                          </CardContent>
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
