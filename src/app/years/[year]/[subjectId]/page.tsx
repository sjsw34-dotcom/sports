import { notFound } from "next/navigation";
import {
  getSubjectById,
  loadConcepts,
  loadExamSets,
  loadQuestionsForYear,
} from "@/lib/data-loader";
import { ExamRunner } from "@/components/exam-runner";
import type { Concept, SubjectId } from "@/lib/types";

export function generateStaticParams() {
  return loadExamSets().map((s) => ({
    year: String(s.year),
    subjectId: s.subjectId,
  }));
}

export default function YearExamPage({
  params,
}: {
  params: { year: string; subjectId: string };
}) {
  const year = Number(params.year);
  if (!Number.isFinite(year)) notFound();

  const subject = getSubjectById(params.subjectId as SubjectId);
  if (!subject) notFound();

  const questions = loadQuestionsForYear(subject.id, year);
  if (questions.length === 0) notFound();

  const concepts = loadConcepts();
  const conceptsById: Record<string, Concept> = Object.fromEntries(
    concepts.map((c) => [c.id, c])
  );

  return (
    <ExamRunner
      subject={subject}
      year={year}
      questions={questions}
      conceptsById={conceptsById}
    />
  );
}
