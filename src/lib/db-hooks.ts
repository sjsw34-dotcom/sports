"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db";
import type {
  AttemptRecord,
  BookmarkRecord,
  SubjectId,
} from "@/lib/types";

export async function recordAttempt(
  input: Omit<AttemptRecord, "id" | "attemptedAt"> & { attemptedAt?: string }
): Promise<void> {
  const db = getDB();
  await db.attempts.add({
    ...input,
    attemptedAt: input.attemptedAt ?? new Date().toISOString(),
  });
}

export async function toggleBookmark(questionId: string): Promise<boolean> {
  const db = getDB();
  const existing = await db.bookmarks.get(questionId);
  if (existing) {
    await db.bookmarks.delete(questionId);
    return false;
  }
  await db.bookmarks.put({
    questionId,
    bookmarkedAt: new Date().toISOString(),
  });
  return true;
}

export async function clearAllAttempts(): Promise<void> {
  await getDB().attempts.clear();
}

export function useAllAttempts(): AttemptRecord[] | undefined {
  return useLiveQuery(() =>
    getDB().attempts.orderBy("attemptedAt").reverse().toArray()
  );
}

export function useAllBookmarks(): BookmarkRecord[] | undefined {
  return useLiveQuery(() =>
    getDB().bookmarks.orderBy("bookmarkedAt").reverse().toArray()
  );
}

export function useIsBookmarked(questionId: string): boolean {
  const rec = useLiveQuery(
    () => getDB().bookmarks.get(questionId),
    [questionId]
  );
  return Boolean(rec);
}

export function useAttemptsBySubject(
  subjectId: SubjectId
): AttemptRecord[] | undefined {
  return useLiveQuery(
    () => getDB().attempts.where("subjectId").equals(subjectId).toArray(),
    [subjectId]
  );
}

/** 문제별 최신 시도를 맵으로 반환 (오답노트·복습용) */
export function latestAttemptMap(
  attempts: AttemptRecord[]
): Map<string, AttemptRecord> {
  const map = new Map<string, AttemptRecord>();
  for (const a of attempts) {
    const cur = map.get(a.questionId);
    if (!cur || a.attemptedAt > cur.attemptedAt) {
      map.set(a.questionId, a);
    }
  }
  return map;
}
