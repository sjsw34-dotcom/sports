/**
 * 정적 JSON 데이터 로더. 서버 컴포넌트/빌드 타임 전용.
 * 클라이언트 컴포넌트에서는 props로 전달받아 사용한다.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  Subject,
  Concept,
  Certification,
  Question,
  SubjectId,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJsonFile<T>(file: string): T {
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as T;
}

export function loadSubjects(): Subject[] {
  return readJsonFile<Subject[]>(path.join(DATA_DIR, "subjects.json"));
}

export function loadConcepts(): Concept[] {
  return readJsonFile<Concept[]>(path.join(DATA_DIR, "concepts.json"));
}

export function loadCertifications(): Certification[] {
  return readJsonFile<Certification[]>(
    path.join(DATA_DIR, "certifications.json")
  );
}

export function loadQuestionsForSubject(subjectId: SubjectId): Question[] {
  const dir = path.join(DATA_DIR, "questions", subjectId);
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("."));
  const all: Question[] = [];
  for (const f of files) {
    const raw = readJsonFile<Question[]>(path.join(dir, f));
    all.push(...raw);
  }
  return all;
}

export function loadAllQuestions(): Question[] {
  const subjects = loadSubjects();
  return subjects.flatMap((s) => loadQuestionsForSubject(s.id));
}

export function getSubjectById(id: SubjectId): Subject | undefined {
  return loadSubjects().find((s) => s.id === id);
}

export function getConceptById(id: string): Concept | undefined {
  return loadConcepts().find((c) => c.id === id);
}

/** 특정 개념이 등장하는 문제들 (역참조) */
export function getQuestionsByConcept(conceptId: string): Question[] {
  return loadAllQuestions().filter((q) => q.conceptIds.includes(conceptId));
}

export interface ExamSetSummary {
  year: number;
  subjectId: SubjectId;
  count: number;
}

/** 연도 × 과목 조합별 문제 수 (연도별 기출 모드용) */
export function loadExamSets(): ExamSetSummary[] {
  const all = loadAllQuestions();
  const map = new Map<string, ExamSetSummary>();
  for (const q of all) {
    const key = `${q.year}-${q.subjectId}`;
    const cur = map.get(key);
    if (cur) {
      cur.count += 1;
    } else {
      map.set(key, { year: q.year, subjectId: q.subjectId, count: 1 });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.year - a.year || a.subjectId.localeCompare(b.subjectId)
  );
}

/** 특정 연도·과목 문제만 (번호 오름차순) */
export function loadQuestionsForYear(
  subjectId: SubjectId,
  year: number
): Question[] {
  return loadQuestionsForSubject(subjectId)
    .filter((q) => q.year === year)
    .sort((a, b) => a.number - b.number);
}
