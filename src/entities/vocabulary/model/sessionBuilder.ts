import { dayKey, shuffle } from "../../../shared/lib";
import { tasksFor } from "./learningEngine";
import type { LearningSession, UserData, Word } from "./types";
export const uniqueWords = (words: Word[]): Word[] => [
  ...new Map(words.map((w) => [w.vocabularyId, w])).values(),
];
export const learnedToday = (data: UserData, now = new Date()) =>
  Object.values(data.progress).filter(
    (p) => p.learnedAt && dayKey(p.learnedAt) === dayKey(now),
  ).length;
export function reviewQueue(data: UserData, now = new Date()): string[] {
  return Object.values(data.progress)
    .filter(
      (p) =>
        p.status === "learned" &&
        p.nextReviewAt &&
        Date.parse(p.nextReviewAt) <= now.getTime(),
    )
    .sort((a, b) => a.nextReviewAt!.localeCompare(b.nextReviewAt!))
    .map((p) => p.vocabularyId);
}
/** Learned words only: overdue recommendations first, then oldest practice. */
export function reviewLessonWords(
  data: UserData,
  words: Word[],
  now = new Date(),
): Word[] {
  const byId = new Map(
    uniqueWords(words).map((word) => [word.vocabularyId, word]),
  );
  const dueAt = (p: UserData["progress"][string]) =>
    p.nextReviewAt && Date.parse(p.nextReviewAt) <= now.getTime()
      ? Date.parse(p.nextReviewAt)
      : null;
  const practicedAt = (p: UserData["progress"][string]) =>
    Date.parse(p.lastReviewedAt ?? p.learnedAt ?? p.addedAt);
  return Object.values(data.progress)
    .filter((p) => p.status === "learned" && byId.has(p.vocabularyId))
    .sort((a, b) => {
      const aDue = dueAt(a),
        bDue = dueAt(b);
      if (aDue !== null && bDue === null) return -1;
      if (aDue === null && bDue !== null) return 1;
      const difference =
        aDue !== null && bDue !== null
          ? aDue - bDue
          : practicedAt(a) - practicedAt(b);
      return difference || a.vocabularyId.localeCompare(b.vocabularyId);
    })
    .slice(0, data.settings.quickAddCount)
    .map((p) => byId.get(p.vocabularyId)!);
}
export function quickLessonWords(
  data: UserData,
  words: Word[],
  now = new Date(),
): Word[] {
  const byId = new Map(uniqueWords(words).map((w) => [w.vocabularyId, w]));
  const due = reviewQueue(data, now);
  const learning = Object.values(data.progress)
    .filter((p) => p.status === "learning")
    .map((p) => p.vocabularyId);
  const learned = Object.values(data.progress)
    .filter((p) => p.status === "learned")
    .map((p) => p.vocabularyId);
  return [...new Set([...due, ...learning, ...learned])]
    .filter((id) => byId.has(id))
    .slice(0, data.settings.quickAddCount)
    .map((id) => byId.get(id)!);
}
/** Selects only learning words for the dashboard draft; never mutates stored data. */
export function randomLearningWords(
  data: UserData,
  words: Word[],
  random = Math.random,
): Word[] {
  const eligible = uniqueWords(words).filter(
    (w) => data.progress[w.vocabularyId]?.status === "learning",
  );
  return shuffle(eligible, random).slice(0, data.settings.quickAddCount);
}
export function buildSession(
  _data: UserData,
  words: Word[],
  mode: LearningSession["mode"],
  now = new Date(),
  setId?: string,
  id: string = crypto.randomUUID(),
): LearningSession {
  const selected = uniqueWords(words);
  const tasks = selected.flatMap(tasksFor);
  return {
    status: "active",
    id,
    mode,
    setId,
    wordIds: selected.map((w) => w.vocabularyId),
    tasks,
    completedTaskIds: [],
    queue: selected.map((w, index) => ({
      id: `${id}:${index}`,
      taskId: tasks.find((t) => t.vocabularyId === w.vocabularyId)!.id,
    })),
    index: 0,
    startedAt: now.toISOString(),
    firstLearnedIds: [],
  };
}
