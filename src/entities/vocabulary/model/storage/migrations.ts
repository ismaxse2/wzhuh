import { buildSession } from "../sessionBuilder";
import type {
  Answer,
  LearningSession,
  SessionSummary,
  UserData,
  UserWordProgress,
} from "../types";
import { resolveSetId, wordById } from "../vocabularyService";
import { emptyData, finalizeSession } from "./model";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const date = (v: unknown): v is string =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
const dateOrNull = (v: unknown) => v === null || date(v);
const count = (v: unknown): v is number =>
  Number.isInteger(v) && Number(v) >= 0;
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const exercise = (v: unknown) =>
  [
    "introduction",
    "recognition",
    "reverse",
    "builder",
    "spelling",
    "context",
  ].includes(String(v));
const stage = (v: unknown) => count(v) && v >= 1 && v <= 7;
const fail = (): never => {
  throw new Error("Повреждены сохранённые данные");
};
export class UnsupportedStorageVersion extends Error {}
function validProgress(v: unknown): v is UserWordProgress {
  return (
    record(v) &&
    typeof v.vocabularyId === "string" &&
    (v.status === "learning" || v.status === "learned") &&
    date(v.addedAt) &&
    dateOrNull(v.learnedAt) &&
    (v.status !== "learned" || date(v.learnedAt)) &&
    dateOrNull(v.nextReviewAt) &&
    dateOrNull(v.lastReviewedAt) &&
    count(v.correctAnswers) &&
    count(v.incorrectAnswers) &&
    count(v.retentionIntervalIndex) &&
    v.retentionIntervalIndex <= 3
  );
}
function validAnswer(v: unknown): v is Answer {
  return (
    record(v) &&
    typeof v.id === "string" &&
    typeof v.taskId === "string" &&
    typeof v.sessionId === "string" &&
    typeof v.vocabularyId === "string" &&
    exercise(v.exercise) &&
    stage(v.stage) &&
    typeof v.correct === "boolean" &&
    date(v.at)
  );
}
function validSummary(v: unknown): v is SessionSummary {
  return (
    record(v) &&
    typeof v.id === "string" &&
    (v.outcome === undefined ||
      v.outcome === "completed" ||
      v.outcome === "endedEarly") &&
    date(v.completedAt) &&
    count(v.exercises) &&
    count(v.correct) &&
    count(v.incorrect) &&
    count(v.learnedWords) &&
    count(v.wordCount)
  );
}
function validSession(v: unknown): v is LearningSession {
  if (
    !record(v) ||
    typeof v.id !== "string" ||
    (v.status !== undefined &&
      !["active", "completed", "endedEarly"].includes(String(v.status))) ||
    !["daily", "set", "dictionary"].includes(String(v.mode)) ||
    !strings(v.wordIds) ||
    !v.wordIds.length ||
    new Set(v.wordIds).size !== v.wordIds.length ||
    !strings(v.completedTaskIds) ||
    !strings(v.firstLearnedIds) ||
    !date(v.startedAt) ||
    !count(v.index) ||
    !Array.isArray(v.tasks) ||
    !Array.isArray(v.queue) ||
    v.index > v.queue.length
  )
    return false;
  const wordIds = v.wordIds;
  if (
    !v.tasks.every(
      (t) =>
        record(t) &&
        typeof t.id === "string" &&
        typeof t.vocabularyId === "string" &&
        wordIds.includes(t.vocabularyId) &&
        stage(t.stage) &&
        exercise(t.exercise),
    )
  )
    return false;
  const taskIds = new Set(v.tasks.map((t) => t.id));
  if (
    taskIds.size !== v.tasks.length ||
    new Set(v.completedTaskIds).size !== v.completedTaskIds.length ||
    !v.completedTaskIds.every((id) => taskIds.has(id))
  )
    return false;
  if (
    !v.queue.every(
      (a) =>
        record(a) &&
        typeof a.id === "string" &&
        typeof a.taskId === "string" &&
        taskIds.has(a.taskId),
    )
  )
    return false;
  if (
    new Set(v.queue.map((a) => a.id)).size !== v.queue.length ||
    !v.firstLearnedIds.every((id) => wordIds.includes(id))
  )
    return false;
  if (
    v.status === "completed" &&
    (v.index !== v.queue.length || v.completedTaskIds.length !== v.tasks.length)
  )
    return false;
  if (v.status === "active" && v.index === v.queue.length) return false;
  const pending = v.queue.slice(v.index).map((a) => a.taskId);
  return (
    new Set(pending).size === pending.length &&
    pending.every((id) => !(v.completedTaskIds as string[]).includes(id)) &&
    (v.index < v.queue.length || v.completedTaskIds.length === v.tasks.length)
  );
}
export function migrate(raw: unknown): UserData {
  if (!record(raw)) return fail();
  if (
    ![0, 1, 2].includes(Number(raw.version)) ||
    typeof raw.version !== "number"
  )
    throw new UnsupportedStorageVersion(
      "Эта версия данных пока не поддерживается",
    );
  const base = emptyData();
  const settings = record(raw.settings) ? raw.settings : {};
  const amount =
    raw.version === 2 ? settings.quickAddCount : settings.dailyLimit;
  base.settings = {
    fontSize:
      settings.fontSize === "large" || settings.fontSize === "extra-large"
        ? settings.fontSize
        : "normal",
    quickAddCount: [5, 10, 15, 20, 30].includes(Number(amount))
      ? Number(amount)
      : 10,
    speechEnabled:
      typeof settings.speechEnabled === "boolean"
        ? settings.speechEnabled
        : true,
    accent: settings.accent === "en-GB" ? "en-GB" : "en-US",
  };
  if (raw.selectedSets !== undefined && !strings(raw.selectedSets))
    return fail();
  base.selectedSets = raw.selectedSets
    ? [...new Set((raw.selectedSets as string[]).map(resolveSetId))]
    : base.selectedSets;
  if (raw.introducedAt !== undefined && !record(raw.introducedAt))
    return fail();
  for (const [id, at] of Object.entries(raw.introducedAt ?? {})) {
    if (!date(at)) return fail();
    base.introducedAt[id] = at;
  }
  if (raw.progress !== undefined && !record(raw.progress)) return fail();
  for (const [id, value] of Object.entries(raw.progress ?? {})) {
    if (raw.version === 2) {
      if (!validProgress(value) || value.vocabularyId !== id) return fail();
      base.progress[id] = value;
    } else {
      if (
        !record(value) ||
        value.vocabularyId !== id ||
        !stage(value.stage) ||
        !count(value.correctAnswers) ||
        !count(value.incorrectAnswers) ||
        !dateOrNull(value.nextReviewAt) ||
        !dateOrNull(value.lastReviewedAt) ||
        !count(value.retentionIntervalIndex) ||
        value.retentionIntervalIndex > 3
      )
        return fail();
      const addedAt =
        base.introducedAt[id] ??
        (date(value.lastReviewedAt)
          ? value.lastReviewedAt
          : new Date().toISOString());
      base.progress[id] = {
        vocabularyId: id,
        status: "learning",
        addedAt,
        learnedAt: null,
        nextReviewAt: null,
        lastReviewedAt: value.lastReviewedAt as string | null,
        correctAnswers: value.correctAnswers,
        incorrectAnswers: value.incorrectAnswers,
        retentionIntervalIndex: 0,
      };
    }
  }
  if (raw.version === 2) {
    if (
      !Array.isArray(raw.answers) ||
      !raw.answers.every(validAnswer) ||
      !Array.isArray(raw.sessions) ||
      !raw.sessions.every(validSummary) ||
      (raw.activeSession !== null && !validSession(raw.activeSession))
    )
      return fail();
    base.answers = raw.answers;
    base.sessions = raw.sessions.map((s) => ({
      ...s,
      outcome: s.outcome ?? "completed",
    }));
    base.activeSession = raw.activeSession
      ? {
          ...raw.activeSession,
          status:
            raw.activeSession.status ??
            (raw.activeSession.index >= raw.activeSession.queue.length
              ? "completed"
              : "active"),
        }
      : null;
    base.migrationNotice = raw.migrationNotice === true;
    if (
      base.activeSession &&
      !base.activeSession.wordIds.every((id) => base.progress[id])
    )
      return fail();
  } else {
    if (raw.answers !== undefined && !Array.isArray(raw.answers)) return fail();
    base.answers = (raw.answers ?? ([] as unknown[])).map((v: unknown) => {
      if (!record(v) || !validAnswer({ ...v, taskId: `legacy:${v.id}` }))
        return fail();
      return { ...v, taskId: `legacy:${v.id}` } as unknown as Answer;
    });
    if (raw.sessions !== undefined && !Array.isArray(raw.sessions))
      return fail();
    base.sessions = (raw.sessions ?? ([] as unknown[])).map((v: unknown) => {
      if (
        !record(v) ||
        typeof v.id !== "string" ||
        !date(v.completedAt) ||
        !count(v.exercises) ||
        !count(v.correct) ||
        !count(v.incorrect) ||
        !count(v.newWords)
      )
        return fail();
      return {
        id: v.id,
        outcome: "completed",
        completedAt: v.completedAt,
        exercises: v.exercises,
        correct: v.correct,
        incorrect: v.incorrect,
        learnedWords: 0,
        wordCount: v.newWords,
      };
    });
    if (raw.activeSession != null) {
      const old = raw.activeSession;
      if (
        !record(old) ||
        typeof old.id !== "string" ||
        !strings(old.queue) ||
        !count(old.index) ||
        old.index > old.queue.length ||
        !date(old.startedAt) ||
        !["daily", "set"].includes(String(old.mode))
      )
        return fail();
      const words = [...new Set(old.queue)].flatMap((id) => {
        const w = wordById.get(id);
        return w ? [w] : [];
      });
      if (words.length) {
        for (const w of words)
          if (!base.progress[w.vocabularyId])
            base.progress[w.vocabularyId] = {
              vocabularyId: w.vocabularyId,
              status: "learning",
              addedAt: old.startedAt,
              learnedAt: null,
              nextReviewAt: null,
              lastReviewedAt: null,
              correctAnswers: 0,
              incorrectAnswers: 0,
              retentionIntervalIndex: 0,
            };
        base.activeSession = buildSession(
          base,
          words,
          old.mode as "daily" | "set",
          new Date(old.startedAt),
          typeof old.setId === "string" ? old.setId : undefined,
          `${old.id}:v2`,
        );
      }
    }
    base.migrationNotice = true;
  }
  return removeFinalTasks(base);
}
function removeFinalTasks(data: UserData): UserData {
  const session = data.activeSession;
  if (!session?.tasks.some((t) => t.stage === 7)) return data;
  const tasks = session.tasks.filter((t) => t.stage <= 6);
  const taskIds = new Set(tasks.map((t) => t.id));
  const completedTaskIds = session.completedTaskIds.filter((id) =>
    taskIds.has(id),
  );
  const queue = session.queue.filter((a) => taskIds.has(a.taskId));
  const index = session.queue
    .slice(0, session.index)
    .filter((a) => taskIds.has(a.taskId)).length;
  const firstLearnedIds = [...session.firstLearnedIds];
  const progress = { ...data.progress };
  const now = new Date();
  for (const id of session.wordIds) {
    const wordTasks = tasks.filter((t) => t.vocabularyId === id);
    if (
      progress[id].status === "learning" &&
      wordTasks.length &&
      wordTasks.every((t) => completedTaskIds.includes(t.id))
    ) {
      progress[id] = {
        ...progress[id],
        status: "learned",
        learnedAt: now.toISOString(),
      };
      firstLearnedIds.push(id);
    }
  }
  return finalizeSession(
    {
      ...data,
      progress,
      activeSession: {
        ...session,
        tasks,
        completedTaskIds,
        queue,
        index,
        firstLearnedIds,
      },
    },
    now,
  );
}
