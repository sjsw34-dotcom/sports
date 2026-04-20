import {
  loadAllQuestions,
  loadConcepts,
  loadSubjects,
} from "@/lib/data-loader";
import { StatsDashboard } from "@/components/stats-dashboard";
import type { Concept, Subject } from "@/lib/types";

export default function StatsIndexPage() {
  const questions = loadAllQuestions();
  const subjects = loadSubjects();
  const concepts = loadConcepts();

  const subjectsById: Record<string, Subject> = Object.fromEntries(
    subjects.map((s) => [s.id, s])
  );
  const conceptsById: Record<string, Concept> = Object.fromEntries(
    concepts.map((c) => [c.id, c])
  );
  const questionsById: Record<string, (typeof questions)[number]> =
    Object.fromEntries(questions.map((q) => [q.id, q]));

  return (
    <StatsDashboard
      subjectsById={subjectsById}
      conceptsById={conceptsById}
      questionsById={questionsById}
    />
  );
}
