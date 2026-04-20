import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadConcepts, loadSubjects } from "@/lib/data-loader";
import type { SubjectId } from "@/lib/types";

export default function ConceptsIndexPage() {
  const concepts = loadConcepts();
  const subjects = loadSubjects();

  const bySubject = concepts.reduce<Record<SubjectId, typeof concepts>>(
    (acc, c) => {
      const list = acc[c.subjectId] ?? [];
      list.push(c);
      acc[c.subjectId] = list;
      return acc;
    },
    {} as Record<SubjectId, typeof concepts>
  );

  const ordered = subjects.filter((s) => bySubject[s.id]?.length);

  return (
    <section className="flex flex-col gap-4 px-4 py-4">
      <header className="px-2 pt-2">
        <h1 className="text-xl font-semibold">개념 사전</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          핵심 개념을 중요도 순으로 정리했습니다. 각 개념 페이지에서 관련 문제와
          연관 개념으로 이어집니다.
        </p>
      </header>

      {ordered.map((subject) => {
        const list = (bySubject[subject.id] ?? [])
          .slice()
          .sort((a, b) => b.importance - a.importance);

        return (
          <section key={subject.id} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 px-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <span aria-hidden>{subject.icon}</span>
              {subject.name}
              <span className="text-xs font-normal">({list.length})</span>
            </h2>
            <ul className="grid gap-2">
              {list.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/concepts/${c.id}` as const}
                    className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <Card className="transition-colors hover:bg-accent">
                      <CardHeader className="gap-1 p-3">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{c.name}</CardTitle>
                          <ImportanceBadge importance={c.importance} />
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {c.definition}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {ordered.length === 0 && (
        <p className="px-2 text-sm text-muted-foreground">
          아직 등록된 개념이 없습니다.
        </p>
      )}

      <p className="px-2 pt-4 text-xs text-muted-foreground">
        {concepts.length}개 개념 수록 · {subjects.length}개 과목
      </p>
    </section>
  );
}

function ImportanceBadge({ importance }: { importance: 1 | 2 | 3 }) {
  const label =
    importance === 3 ? "중요 ★★★" : importance === 2 ? "중요 ★★" : "기본";
  const variant =
    importance === 3 ? "default" : importance === 2 ? "secondary" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}
