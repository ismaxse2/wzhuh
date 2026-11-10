import { initialProgress, scheduleCompletedLesson } from "../reviewScheduler";
import { buildSession, uniqueWords } from "../sessionBuilder";
import type { SessionSummary, UserData, Word } from "../types";
export const STORAGE_VERSION = 2;
export const emptyData = (): UserData => ({
  version: 2,
  progress: {},
  settings: {
    fontSize: "normal",
    quickAddCount: 10,
    speechEnabled: true,
    accent: "en-US",
  },
  answers: [],
  introducedAt: {},
  sessions: [],
  selectedSets: ["everyday-300"],
  activeSession: null,
  migrationNotice: false,
});
export function addWords(
  data: UserData,
  words: Word[],
  now = new Date(),
): UserData {
  const fresh = uniqueWords(words).filter(
    (w) => !data.progress[w.vocabularyId],
  );
  if (!fresh.length) return data;
  return {
    ...data,
    progress: {
      ...data.progress,
      ...Object.fromEntries(
        fresh.map((w) => [
          w.vocabularyId,
          initialProgress(w.vocabularyId, now),
        ]),
      ),
    },
  };
}
export function changeWordStatus(
  data: UserData,
  vocabularyId: string,
  status: UserData["progress"][string]["status"],
  now = new Date(),
): UserData {
  const previous = data.progress[vocabularyId];
  if (!previous || previous.status === status) return data;
  return {
    ...data,
    progress: {
      ...data.progress,
      [vocabularyId]: {
        ...previous,
        status,
        learnedAt:
          status === "learned" && !previous.learnedAt
            ? now.toISOString()
            : previous.learnedAt,
      },
    },
  };
}
export function startLesson(
  data: UserData,
  words: Word[],
  mode: NonNullable<UserData["activeSession"]>["mode"] = "dictionary",
  now = new Date(),
  setId?: string,
  id?: string,
): UserData {
  if (data.activeSession?.status === "active") return data;
  const selected = uniqueWords(words);
  if (!selected.length) return data;
  return {
    ...addWords(data, selected, now),
    activeSession: buildSession(data, selected, mode, now, setId, id),
  };
}
export function completeExercise(
  data: UserData,
  input: { id: string; sessionId: string; taskId: string; correct: boolean },
  now = new Date(),
): UserData {
  const session = data.activeSession;
  const attempt = session?.queue[session.index];
  if (
    !session ||
    session.status !== "active" ||
    session.id !== input.sessionId ||
    !attempt ||
    attempt.id !== input.id ||
    attempt.taskId !== input.taskId ||
    data.answers.some((a) => a.id === input.id)
  )
    return data;
  const task = session.tasks.find((t) => t.id === attempt.taskId);
  if (!task || session.completedTaskIds.includes(task.id)) return data;
  const correct = task.exercise === "introduction" || input.correct;
  const previous = data.progress[task.vocabularyId];
  if (!previous) return data;
  const answer = {
    id: attempt.id,
    taskId: task.id,
    sessionId: session.id,
    vocabularyId: task.vocabularyId,
    exercise: task.exercise,
    stage: task.stage,
    correct,
    at: now.toISOString(),
  };
  const answers = [...data.answers, answer];
  const completedTaskIds = correct
    ? [...session.completedTaskIds, task.id]
    : session.completedTaskIds;
  const wordTasks = session.tasks.filter(
    (t) => t.vocabularyId === task.vocabularyId,
  );
  const next = correct
    ? wordTasks.find((t) => !completedTaskIds.includes(t.id))
    : task;
  const nextAttemptNumber =
    [
      ...session.queue,
      ...data.answers.filter((a) => a.sessionId === session.id),
    ].reduce(
      (max, a) => Math.max(max, Number(a.id.slice(session.id.length + 1)) || 0),
      -1,
    ) + 1;
  const queue = next
    ? [
        ...session.queue,
        { id: `${session.id}:${nextAttemptNumber}`, taskId: next.id },
      ]
    : session.queue;
  const firstLearned = !next && !previous.learnedAt;
  const firstLearnedIds = firstLearned
    ? [...session.firstLearnedIds, task.vocabularyId]
    : session.firstLearnedIds;
  const progress = {
    ...data.progress,
    [task.vocabularyId]: {
      ...previous,
      status: !next ? ("learned" as const) : previous.status,
      learnedAt: firstLearned ? now.toISOString() : previous.learnedAt,
      correctAnswers:
        previous.correctAnswers +
        (correct && task.exercise !== "introduction" ? 1 : 0),
      incorrectAnswers: previous.incorrectAnswers + (!correct ? 1 : 0),
    },
  };
  const activeSession = {
    ...session,
    index: session.index + 1,
    queue,
    completedTaskIds,
    firstLearnedIds,
  };
  return finalizeSession(
    {
      ...data,
      progress,
      answers,
      activeSession,
      introducedAt: data.introducedAt[task.vocabularyId]
        ? data.introducedAt
        : { ...data.introducedAt, [task.vocabularyId]: now.toISOString() },
    },
    now,
  );
}
/** Also used when removing obsolete tasks from a saved lesson. */
export function finalizeSession(data: UserData, now = new Date()): UserData {
  const session = data.activeSession;
  if (
    !session ||
    session.status === "endedEarly" ||
    session.completedTaskIds.length !== session.tasks.length ||
    data.sessions.some((s) => s.id === session.id)
  )
    return data;
  const sessionAnswers = data.answers.filter((a) => a.sessionId === session.id);
  const hadErrors = sessionAnswers.some((a) => !a.correct);
  const progress = { ...data.progress };
  for (const id of session.wordIds)
    progress[id] = scheduleCompletedLesson(
      progress[id],
      session.firstLearnedIds.includes(id),
      hadErrors,
      now,
    );
  return {
    ...data,
    progress,
    activeSession: { ...session, status: "completed" },
    sessions: [...data.sessions, summarizeSession(data, "completed", now)],
  };
}
function summarizeSession(
  data: UserData,
  outcome: SessionSummary["outcome"],
  now: Date,
): SessionSummary {
  const session = data.activeSession!;
  const answers = data.answers.filter((a) => a.sessionId === session.id);
  return {
    id: session.id,
    outcome,
    completedAt: now.toISOString(),
    exercises: answers.length,
    correct: answers.filter((a) => a.correct && a.exercise !== "introduction")
      .length,
    incorrect: answers.filter((a) => !a.correct).length,
    learnedWords: session.firstLearnedIds.length,
    wordCount: session.wordIds.length,
  };
}
export function endLesson(data: UserData, now = new Date()): UserData {
  const session = data.activeSession;
  if (!session || session.status !== "active") return data;
  return {
    ...data,
    activeSession: { ...session, status: "endedEarly" },
    sessions: [...data.sessions, summarizeSession(data, "endedEarly", now)],
  };
}
