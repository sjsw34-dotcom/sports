/**
 * 전역 도메인 타입. 원본 정의는 docs/DATA_SCHEMA.md.
 * 스키마 변경 시 DATA_SCHEMA.md를 먼저 수정하고 여기에 반영한다.
 */

export type SubjectId =
  | "sports-education"
  | "sports-sociology"
  | "sports-psychology"
  | "exercise-physiology"
  | "exercise-mechanics"
  | "korean-pe-history"
  | "sports-ethics"
  | "youth-pe"
  | "senior-pe";

export type CertId = "life-2" | "youth" | "senior";

export type Difficulty = "easy" | "mid" | "hard";

export type QuestionSource = "past-exam" | "predicted" | "practice";

export interface Subject {
  id: SubjectId;
  name: string;
  shortName: string;
  nameEn: string;
  description: string;
  icon: string;
  color: string;
  requiredFor: {
    certId: CertId;
    type: "required" | "optional";
  }[];
  totalQuestions?: number;
}

export interface Question {
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
  difficulty?: Difficulty;
  tags?: string[];
  sourcePdf?: string;
  sourceRef?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Concept {
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

export interface Certification {
  id: CertId;
  name: string;
  level: string;
  type: "life" | "youth" | "senior" | "pro" | "disabled" | "health";
  requiredSubjects: SubjectId[];
  optionalSubjects: SubjectId[];
  examConfig: {
    totalSubjects: number;
    questionsPerSubject: number;
    timeLimit: number;
    passingScore: number;
  };
}

/** IndexedDB 세션 타입 (로컬 저장 전용) */
export interface AttemptRecord {
  id?: number;
  questionId: string;
  subjectId: SubjectId;
  chosenAnswer: number;
  isCorrect: boolean;
  attemptedAt: string;
  timeSpentMs?: number;
}

export interface BookmarkRecord {
  questionId: string;
  bookmarkedAt: string;
  note?: string;
}

export interface ReviewSession {
  id?: number;
  subjectId: SubjectId;
  year?: number;
  startedAt: string;
  finishedAt?: string;
  totalQuestions: number;
  correctCount: number;
}
