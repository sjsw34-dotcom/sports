/**
 * data/ 디렉터리의 JSON 유효성 검증.
 * 실행: npm run validate:data
 *
 * 검증 항목:
 *  - subjects.json, certifications.json, concepts.json, questions/** 파싱
 *  - Question: choices 길이, answer 범위, conceptIds 존재, id 패턴, source/파일 일치
 *  - Concept: id kebab-case, relatedConceptIds 존재, 자기 참조 금지
 *  - 해설/상세 안 {{concept:xxx}} 태그 실존 여부
 *  - 개념 양방향 관계 (경고)
 */

import fs from "node:fs";
import path from "node:path";

type SubjectId = string;
type CertId = string;
type QuestionSource = "past-exam" | "predicted" | "practice";

interface Subject {
  id: SubjectId;
  name: string;
  shortName: string;
  nameEn: string;
  description: string;
  icon: string;
  color: string;
  requiredFor: { certId: CertId; type: "required" | "optional" }[];
}

interface Question {
  id: string;
  subjectId: SubjectId;
  year: number;
  number: number;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  enhancedExplanation?: string;
  conceptIds: string[];
  source: QuestionSource;
  difficulty?: "easy" | "mid" | "hard";
  tags?: string[];
  sourcePdf?: string;
  sourceRef?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Concept {
  id: string;
  name: string;
  nameEn?: string;
  subjectId: SubjectId;
  definition: string;
  details: string;
  relatedConceptIds: string[];
  keywords: string[];
  importance: 1 | 2 | 3;
  sources?: string[];
}

interface Certification {
  id: CertId;
  name: string;
  level: string;
  type: string;
  requiredSubjects: SubjectId[];
  optionalSubjects: SubjectId[];
  examConfig: {
    totalSubjects: number;
    questionsPerSubject: number;
    timeLimit: number;
    passingScore: number;
  };
}

const ROOT = path.resolve(process.cwd());
const DATA = path.join(ROOT, "data");

const errors: string[] = [];
const warnings: string[] = [];

function err(msg: string): void {
  errors.push(msg);
}
function warn(msg: string): void {
  warnings.push(msg);
}

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    err(`[${path.relative(ROOT, file)}] JSON 파싱 실패: ${reason}`);
    throw e;
  }
}

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CONCEPT_TAG_RE = /\{\{concept:([a-z0-9-]+)\}\}/g;
const ID_PATTERNS: Record<QuestionSource, RegExp> = {
  "past-exam": /^(\d{4})-([a-z-]+)-(\d{1,3})$/,
  practice: /^(\d{4})-([a-z-]+)-p(\d{2,3})$/,
  predicted: /^(\d{4})-([a-z-]+)-e(\d{2,3})$/,
};
const FILENAME_SOURCE: Record<string, QuestionSource> = {
  "": "past-exam",
  "-practice": "practice",
  "-predicted": "predicted",
};

function collectConceptTags(markdown: string): string[] {
  const ids: string[] = [];
  for (const m of markdown.matchAll(CONCEPT_TAG_RE)) {
    const id = m[1];
    if (id) ids.push(id);
  }
  return ids;
}

function validateQuestionFile(
  file: string,
  subjectId: SubjectId,
  conceptIds: Set<string>,
  subjectIds: Set<SubjectId>
): void {
  const rel = path.relative(ROOT, file);
  const basename = path.basename(file, ".json");
  const match = basename.match(/^(\d{4})(-practice|-predicted)?$/);
  if (!match) {
    err(`[${rel}] 파일명 형식 오류. {year}.json | {year}-practice.json | {year}-predicted.json`);
    return;
  }
  const fileYear = Number(match[1]);
  const suffix = match[2] ?? "";
  const expectedSource = FILENAME_SOURCE[suffix];
  if (!expectedSource) {
    err(`[${rel}] 알 수 없는 파일명 접미사: ${suffix}`);
    return;
  }

  const questions = readJson<Question[]>(file);
  if (!Array.isArray(questions)) {
    err(`[${rel}] 최상위가 배열이 아님`);
    return;
  }

  const seenIds = new Set<string>();
  for (const [i, q] of questions.entries()) {
    const where = `[${rel}#${i}]`;

    if (!q.id || typeof q.id !== "string") {
      err(`${where} id 누락`);
      continue;
    }
    if (seenIds.has(q.id)) err(`${where} 중복 id: ${q.id}`);
    seenIds.add(q.id);

    if (q.subjectId !== subjectId) {
      err(`${where} subjectId(${q.subjectId}) != 폴더(${subjectId})`);
    }
    if (!subjectIds.has(q.subjectId)) {
      err(`${where} 존재하지 않는 subjectId: ${q.subjectId}`);
    }

    if (q.year !== fileYear) {
      err(`${where} year(${q.year}) != 파일명 year(${fileYear})`);
    }

    if (q.source !== expectedSource) {
      err(`${where} source(${q.source}) != 파일명 기반 예상(${expectedSource})`);
    }

    const idRe = ID_PATTERNS[q.source];
    if (!idRe || !idRe.test(q.id)) {
      err(`${where} id 패턴 불일치 (source=${q.source}): ${q.id}`);
    }

    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      err(`${where} choices 길이 != 4`);
    }
    if (typeof q.answer !== "number" || q.answer < 0 || q.answer > 3) {
      err(`${where} answer 범위 오류: ${q.answer}`);
    }

    if (!Array.isArray(q.conceptIds)) {
      err(`${where} conceptIds 누락`);
    } else {
      for (const cid of q.conceptIds) {
        if (!conceptIds.has(cid)) {
          err(`${where} 존재하지 않는 conceptId: ${cid}`);
        }
      }
    }

    const tagged = [
      ...collectConceptTags(q.explanation ?? ""),
      ...collectConceptTags(q.enhancedExplanation ?? ""),
    ];
    for (const cid of tagged) {
      if (!conceptIds.has(cid)) {
        err(`${where} 해설의 {{concept:${cid}}}가 concepts.json에 없음`);
      }
    }

    if (typeof q.verified !== "boolean") err(`${where} verified 누락`);
    if (!q.createdAt) err(`${where} createdAt 누락`);
    if (!q.updatedAt) err(`${where} updatedAt 누락`);
  }
}

function validateConcepts(concepts: Concept[]): Set<string> {
  const ids = new Set<string>();
  for (const c of concepts) {
    if (ids.has(c.id)) err(`[concepts.json] 중복 id: ${c.id}`);
    ids.add(c.id);
    if (!KEBAB_RE.test(c.id)) err(`[concepts.json] id가 kebab-case 아님: ${c.id}`);
    if (!c.name) err(`[concepts.json:${c.id}] name 누락`);
    if (![1, 2, 3].includes(c.importance)) {
      err(`[concepts.json:${c.id}] importance는 1|2|3: ${c.importance}`);
    }
  }

  // relatedConceptIds 존재, 자기 참조 금지, 본문 태그
  for (const c of concepts) {
    for (const rel of c.relatedConceptIds) {
      if (rel === c.id) err(`[concepts.json:${c.id}] 자기 자신을 relatedConceptIds에 포함`);
      if (!ids.has(rel)) err(`[concepts.json:${c.id}] relatedConcept 미존재: ${rel}`);
    }
    for (const tag of collectConceptTags(c.details)) {
      if (!ids.has(tag)) err(`[concepts.json:${c.id}] details의 {{concept:${tag}}} 미존재`);
    }
  }

  // 양방향 관계 (경고)
  const relMap = new Map<string, Set<string>>();
  for (const c of concepts) relMap.set(c.id, new Set(c.relatedConceptIds));
  for (const c of concepts) {
    for (const rel of c.relatedConceptIds) {
      const back = relMap.get(rel);
      if (back && !back.has(c.id)) {
        warn(`[concepts.json] 비대칭 관계: ${c.id} -> ${rel} 이 있으나 역방향 없음`);
      }
    }
  }

  return ids;
}

function validateSubjects(subjects: Subject[]): Set<SubjectId> {
  const ids = new Set<SubjectId>();
  for (const s of subjects) {
    if (ids.has(s.id)) err(`[subjects.json] 중복 id: ${s.id}`);
    ids.add(s.id);
    if (!KEBAB_RE.test(s.id)) err(`[subjects.json:${s.id}] id kebab 아님`);
    if (!s.color.startsWith("#")) err(`[subjects.json:${s.id}] color hex 아님`);
  }
  return ids;
}

function validateCertifications(
  certs: Certification[],
  subjectIds: Set<SubjectId>
): void {
  const ids = new Set<CertId>();
  for (const c of certs) {
    if (ids.has(c.id)) err(`[certifications.json] 중복 id: ${c.id}`);
    ids.add(c.id);
    for (const s of [...c.requiredSubjects, ...c.optionalSubjects]) {
      if (!subjectIds.has(s)) {
        err(`[certifications.json:${c.id}] 미존재 subjectId: ${s}`);
      }
    }
  }
}

function main(): number {
  const subjects = readJson<Subject[]>(path.join(DATA, "subjects.json"));
  const concepts = readJson<Concept[]>(path.join(DATA, "concepts.json"));
  const certifications = readJson<Certification[]>(
    path.join(DATA, "certifications.json")
  );

  const subjectIds = validateSubjects(subjects);
  const conceptIds = validateConcepts(concepts);
  validateCertifications(certifications, subjectIds);

  // 과목 subjectId와 concept.subjectId 연결 검증
  for (const c of concepts) {
    if (!subjectIds.has(c.subjectId)) {
      err(`[concepts.json:${c.id}] 미존재 subjectId: ${c.subjectId}`);
    }
  }

  const questionsRoot = path.join(DATA, "questions");
  if (fs.existsSync(questionsRoot)) {
    for (const subjDir of fs.readdirSync(questionsRoot)) {
      const subjPath = path.join(questionsRoot, subjDir);
      if (!fs.statSync(subjPath).isDirectory()) continue;
      if (!subjectIds.has(subjDir)) {
        err(`[data/questions/${subjDir}/] 폴더명이 subjects.json에 없음`);
        continue;
      }
      for (const file of fs.readdirSync(subjPath)) {
        if (!file.endsWith(".json")) continue;
        validateQuestionFile(
          path.join(subjPath, file),
          subjDir,
          conceptIds,
          subjectIds
        );
      }
    }
  }

  if (warnings.length > 0) {
    console.log(`\n경고 ${warnings.length}건:`);
    for (const w of warnings) console.log("  ⚠ " + w);
  }

  if (errors.length > 0) {
    console.log(`\n오류 ${errors.length}건:`);
    for (const e of errors) console.log("  ✗ " + e);
    console.log("\n검증 실패.");
    return 1;
  }

  console.log(
    `\n✓ 검증 통과. subjects=${subjects.length}, concepts=${concepts.length}, certs=${certifications.length}`
  );
  return 0;
}

process.exit(main());
