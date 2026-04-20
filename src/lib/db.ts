import Dexie, { type Table } from "dexie";
import type {
  AttemptRecord,
  BookmarkRecord,
  ReviewSession,
} from "@/lib/types";

/**
 * IndexedDB 스키마.
 * 오답노트, 북마크, 학습 세션만 저장. 문제/개념 원본은 정적 JSON에서 로드.
 */
export class ChedoDB extends Dexie {
  attempts!: Table<AttemptRecord, number>;
  bookmarks!: Table<BookmarkRecord, string>;
  sessions!: Table<ReviewSession, number>;

  constructor() {
    super("chedo-prep");
    this.version(1).stores({
      attempts: "++id, questionId, subjectId, isCorrect, attemptedAt",
      bookmarks: "questionId, bookmarkedAt",
      sessions: "++id, subjectId, year, startedAt",
    });
  }
}

let _db: ChedoDB | null = null;

/** 브라우저에서만 호출되는 지연 초기화 싱글톤 */
export function getDB(): ChedoDB {
  if (typeof window === "undefined") {
    throw new Error("getDB()는 클라이언트 컴포넌트에서만 호출해야 합니다.");
  }
  if (!_db) _db = new ChedoDB();
  return _db;
}
