import {
  loadAllQuestions,
  loadConcepts,
  loadSubjects,
} from "@/lib/data-loader";
import { MockExam } from "@/components/mock-exam";
import type { Concept } from "@/lib/types";

export default function MockExamPage() {
  const subjects = loadSubjects();
  const questions = loadAllQuestions();
  const concepts = loadConcepts();
  const conceptsById: Record<string, Concept> = Object.fromEntries(
    concepts.map((c) => [c.id, c])
  );

  return (
    <MockExam
      subjects={subjects}
      questions={questions}
      conceptsById={conceptsById}
    />
  );
}
