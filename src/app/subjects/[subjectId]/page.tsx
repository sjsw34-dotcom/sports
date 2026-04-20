import { notFound } from "next/navigation";
import {
  loadSubjects,
  loadQuestionsForSubject,
  loadConcepts,
  getSubjectById,
} from "@/lib/data-loader";
import { SubjectPractice } from "@/components/subject-practice";
import type { Concept } from "@/lib/types";

export function generateStaticParams() {
  return loadSubjects().map((s) => ({ subjectId: s.id }));
}

export default function SubjectPracticePage({
  params,
}: {
  params: { subjectId: string };
}) {
  const subject = getSubjectById(params.subjectId as never);
  if (!subject) notFound();

  const questions = loadQuestionsForSubject(subject.id);
  const concepts = loadConcepts();
  const conceptsById: Record<string, Concept> = Object.fromEntries(
    concepts.map((c) => [c.id, c])
  );

  return (
    <SubjectPractice
      subject={subject}
      questions={questions}
      conceptsById={conceptsById}
    />
  );
}
