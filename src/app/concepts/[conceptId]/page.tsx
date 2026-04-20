import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MarkdownContent } from "@/components/markdown-content";
import {
  getConceptById,
  getQuestionsByConcept,
  loadConcepts,
  loadSubjects,
} from "@/lib/data-loader";
import type { Concept, QuestionSource } from "@/lib/types";

const SOURCE_LABEL: Record<QuestionSource, string> = {
  "past-exam": "기출",
  practice: "연습",
  predicted: "예상",
};

export function generateStaticParams() {
  return loadConcepts().map((c) => ({ conceptId: c.id }));
}

export default function ConceptDetailPage({
  params,
}: {
  params: { conceptId: string };
}) {
  const concept = getConceptById(params.conceptId);
  if (!concept) notFound();

  const concepts = loadConcepts();
  const subjects = loadSubjects();
  const subjectById = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const conceptsById: Record<string, Concept> = Object.fromEntries(
    concepts.map((c) => [c.id, c])
  );
  const subject = subjectById[concept.subjectId];
  const related = concept.relatedConceptIds
    .map((id) => conceptsById[id])
    .filter((c): c is Concept => Boolean(c));
  const backlinks = getQuestionsByConcept(concept.id);

  return (
    <article className="flex flex-col gap-5 px-4 py-4">
      <Link
        href="/concepts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        개념 사전
      </Link>

      <header className="flex flex-col gap-2 px-1">
        <div className="flex items-center gap-2">
          {subject && (
            <Badge variant="outline">
              {subject.icon} {subject.name}
            </Badge>
          )}
          {concept.nameEn && (
            <span className="text-xs text-muted-foreground">
              {concept.nameEn}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-tight">{concept.name}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {concept.definition}
        </p>
      </header>

      <section className="px-1">
        <MarkdownContent source={concept.details} conceptsById={conceptsById} />
      </section>

      {related.length > 0 && (
        <section className="px-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            관련 개념
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/concepts/${r.id}` as const}
                className="rounded-full"
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer transition-colors hover:bg-accent"
                >
                  {r.name}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {backlinks.length > 0 && (
        <section className="px-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            이 개념이 등장한 문제 ({backlinks.length})
          </h2>
          <ul className="grid gap-2">
            {backlinks.map((q) => (
              <li key={q.id}>
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader className="gap-2 p-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary">
                        {q.year} · {SOURCE_LABEL[q.source]}
                      </Badge>
                      {subjectById[q.subjectId] && (
                        <Badge variant="outline">
                          {subjectById[q.subjectId]?.shortName}
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        #{q.number}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="line-clamp-3 text-sm leading-relaxed">
                      {q.question}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {concept.keywords.length > 0 && (
        <section className="px-1 pb-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            키워드
          </h2>
          <p className="text-xs text-muted-foreground">
            {concept.keywords.join(" · ")}
          </p>
        </section>
      )}
    </article>
  );
}
