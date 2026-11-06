import type { UserWordProgress } from "./types";
export const RETENTION_DAYS = [14, 30, 60, 120] as const;
export function initialProgress(
  vocabularyId: string,
  now = new Date(),
): UserWordProgress {
  return {
    vocabularyId,
    status: "learning",
    addedAt: now.toISOString(),
    learnedAt: null,
    nextReviewAt: null,
    lastReviewedAt: null,
    correctAnswers: 0,
    incorrectAnswers: 0,
    retentionIntervalIndex: 0,
  };
}
/** Recommendations never control access to lessons. Only a completed full lesson schedules a review. */
export function scheduleCompletedLesson(
  progress: UserWordProgress,
  firstLearning: boolean,
  hadErrors: boolean,
  now: Date,
): UserWordProgress {
  const index =
    firstLearning || !progress.nextReviewAt || hadErrors
      ? 0
      : Math.min(progress.retentionIntervalIndex + 1, 3);
  return {
    ...progress,
    retentionIntervalIndex: index,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: new Date(
      now.getTime() + RETENTION_DAYS[index] * 86400_000,
    ).toISOString(),
  };
}
