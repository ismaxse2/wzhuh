import { describe, expect, it } from "vitest";

import {
  checkSpellingAnswer,
  choicesFor,
  contextChoicesFor,
  tasksFor,
} from "./learningEngine";
import { initialProgress, scheduleCompletedLesson } from "./reviewScheduler";
import {
  buildSession,
  learnedToday,
  quickLessonWords,
  randomLearningWords,
  reviewLessonWords,
  reviewQueue,
} from "./sessionBuilder";
import { migrate, UnsupportedStorageVersion } from "./storage/migrations";
import {
  addWords,
  completeExercise,
  emptyData,
  endLesson,
  startLesson,
} from "./storage/model";
import { LocalUserRepository } from "./storage/storageService";
import type { UserData } from "./types";
import { allWords, wordSets } from "./vocabularyService";
import {
  buildLetters,
  canBuild,
  checkAnswer,
  contextParts,
} from "./wordExercises";
const now = new Date("2026-11-05T12:00:00Z");
const words = allWords.slice(0, 2);
function answer(data: UserData, correct = true) {
  const s = data.activeSession!;
  const a = s.queue[s.index];
  return completeExercise(
    data,
    { id: a.id, sessionId: s.id, taskId: a.taskId, correct },
    now,
  );
}
function finish(data: UserData) {
  let next = data;
  for (
    let i = 0;
    i < 1000 && next.activeSession!.index < next.activeSession!.queue.length;
    i++
  )
    next = answer(next);
  return next;
}
function begin(selected = words) {
  return startLesson(
    emptyData(),
    selected,
    "dictionary",
    now,
    undefined,
    "lesson",
  );
}
describe("full lessons", () => {
  it("creates only the six main stages", () => {
    const tasks = tasksFor(words[0]);
    expect(tasks).toHaveLength(6);
    expect(tasks.map((t) => t.stage)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(tasks.slice(3).map((t) => t.exercise)).toEqual([
      "builder",
      "spelling",
      "context",
    ]);
  });
  it("starts with all introductions and interleaves successive stages", () => {
    let d = begin();
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      const s = d.activeSession!;
      const t = s.tasks.find((t) => t.id === s.queue[s.index].taskId)!;
      order.push(`${t.vocabularyId}:${t.stage}`);
      d = answer(d);
    }
    expect(order).toEqual(
      words
        .map((w) => `${w.vocabularyId}:1`)
        .concat(
          words.map((w) => `${w.vocabularyId}:2`),
          words.map((w) => `${w.vocabularyId}:3`),
        ),
    );
  });
  it("requires every selected word to finish every task", () => {
    let d = begin();
    for (let i = 0; i < 10; i++) d = answer(d);
    expect(
      Object.values(d.progress).every((p) => p.status === "learning"),
    ).toBe(true);
    expect(d.sessions).toHaveLength(0);
    d = finish(d);
    expect(d.sessions).toHaveLength(1);
    expect(d.sessions[0]).toMatchObject({
      wordCount: 2,
      learnedWords: 2,
      exercises: 12,
      correct: 10,
      incorrect: 0,
    });
    expect(Object.values(d.progress).every((p) => p.status === "learned")).toBe(
      true,
    );
    expect(d.activeSession!.completedTaskIds).toHaveLength(12);
    expect(learnedToday(d, now)).toBe(2);
  });
  it.each([1, 2, 3, 4, 5])(
    "requeues failed task %i without resetting completed tasks",
    (taskIndex) => {
      let d = begin([words[0]]);
      for (let i = 0; i < taskIndex; i++) d = answer(d);
      const before = d.activeSession!;
      const attempt = before.queue[before.index];
      d = answer(d, false);
      expect(d.activeSession!.completedTaskIds).toEqual(
        before.completedTaskIds,
      );
      expect(d.activeSession!.queue.at(-1)!.taskId).toBe(attempt.taskId);
      expect(d.activeSession!.queue.at(-1)!.id).not.toBe(attempt.id);
      expect(d.sessions).toHaveLength(0);
      expect(d.progress[words[0].vocabularyId].nextReviewAt).toBeNull();
      d = finish(d);
      expect(d.answers).toHaveLength(7);
      expect(d.sessions[0].incorrect).toBe(1);
      expect(d.progress[words[0].vocabularyId].status).toBe("learned");
    },
  );
  it("places a retry after the other pending cards with no waiting", () => {
    let d = begin();
    d = answer(answer(d));
    const attempt = d.activeSession!.queue[d.activeSession!.index];
    d = answer(d, false);
    const pending = d.activeSession!.queue.slice(d.activeSession!.index);
    expect(pending.at(-1)!.taskId).toBe(attempt.taskId);
    expect(pending[0].taskId).not.toBe(attempt.taskId);
  });
  it("does not finish after repeated failures and eventually accepts a correct retry", () => {
    let d = answer(begin([words[0]]));
    for (let i = 0; i < 25; i++) d = answer(d, false);
    expect(d.sessions).toHaveLength(0);
    expect(d.activeSession!.completedTaskIds).toHaveLength(1);
    d = finish(d);
    expect(d.sessions[0].incorrect).toBe(25);
  });
  it("marks learned only after every main stage succeeds", () => {
    let d = begin([words[0]]);
    for (let i = 0; i < 5; i++) {
      d = answer(d);
      expect(d.progress[words[0].vocabularyId].status).toBe("learning");
    }
    d = answer(d);
    expect(d.progress[words[0].vocabularyId].status).toBe("learned");
  });
  it("allows an immediate full replay and preserves learned status after an error", () => {
    let d = finish(begin([words[0]]));
    const learnedAt = d.progress[words[0].vocabularyId].learnedAt;
    d = startLesson(d, [words[0]], "dictionary", now, undefined, "replay");
    expect(d.activeSession!.tasks).toHaveLength(6);
    d = answer(answer(d), false);
    expect(d.progress[words[0].vocabularyId].status).toBe("learned");
    d = finish(d);
    expect(d.sessions.at(-1)!.learnedWords).toBe(0);
    expect(d.progress[words[0].vocabularyId].learnedAt).toBe(learnedAt);
  });
  it("does not replace an unfinished lesson", () => {
    const d = begin();
    expect(startLesson(d, allWords)).toBe(d);
  });
  it("does not count interrupted lessons as completed", () => {
    let d = answer(begin());
    d = { ...d, activeSession: null };
    expect(d.sessions).toHaveLength(0);
    expect(d.answers).toHaveLength(1);
  });
  it("skips unshufflable builder tasks only", () => {
    const w = { ...words[0], word: "a" };
    expect(tasksFor(w)).toHaveLength(5);
    expect(tasksFor(w).some((t) => t.exercise === "builder")).toBe(false);
    expect(finish(begin([w])).progress[w.vocabularyId].status).toBe("learned");
  });
  it("handles an empty selection and deduplicates vocabulary", () => {
    expect(startLesson(emptyData(), []).activeSession).toBeNull();
    const d = begin([words[0], words[0]]);
    expect(d.activeSession!.wordIds).toHaveLength(1);
    expect(d.activeSession!.tasks).toHaveLength(6);
  });
});
describe("dictionary and recommendations", () => {
  it("adds all words with no cap and no progress reset", () => {
    const d = addWords(
      emptyData(),
      wordSets.flatMap((s) => s.words),
      now,
    );
    expect(Object.keys(d.progress)).toHaveLength(
      new Set(wordSets.flatMap((s) => s.words.map((w) => w.vocabularyId))).size,
    );
    expect(
      Object.values(d.progress).every((p) => p.status === "learning"),
    ).toBe(true);
    expect(
      addWords(
        d,
        wordSets.flatMap((s) => s.words),
        now,
      ),
    ).toBe(d);
  });
  it("ignores quick count when a manual lesson selects more words", () => {
    const d = emptyData();
    d.settings.quickAddCount = 5;
    expect(startLesson(d, allWords).activeSession!.wordIds).toHaveLength(
      allWords.length,
    );
  });
  it("settings changes do not shrink an active lesson", () => {
    let d = begin(allWords);
    const ids = d.activeSession!.wordIds;
    d = { ...d, settings: { ...d.settings, quickAddCount: 5 } };
    d = answer(d);
    expect(d.activeSession!.wordIds).toEqual(ids);
  });
  it("prioritizes due recommendations, learning, then learned, capped only for quick launch", () => {
    let d = addWords(emptyData(), allWords.slice(0, 8), now);
    d.settings.quickAddCount = 5;
    for (const i of [0, 1])
      d.progress[allWords[i].vocabularyId] = {
        ...d.progress[allWords[i].vocabularyId],
        status: "learned",
        learnedAt: now.toISOString(),
        nextReviewAt: i === 1 ? "2026-11-01T00:00:00Z" : "2026-12-01T00:00:00Z",
      };
    expect(
      quickLessonWords(d, allWords, now).map((w) => w.vocabularyId),
    ).toEqual(
      [allWords[1], ...allWords.slice(2, 6)].map((w) => w.vocabularyId),
    );
    expect(reviewQueue(d, now)).toEqual([allWords[1].vocabularyId]);
    d = emptyData();
    expect(quickLessonWords(d, allWords, now)).toEqual([]);
  });
  it("schedules 14 → 30 → 60 → 120 → 120 days only after full lessons", () => {
    let p = initialProgress("test", now);
    for (const [i, days] of [14, 30, 60, 120, 120].entries()) {
      p = scheduleCompletedLesson(p, i === 0, false, now);
      expect((Date.parse(p.nextReviewAt!) - now.getTime()) / 86400_000).toBe(
        days,
      );
    }
    expect(
      scheduleCompletedLesson(p, false, true, now).retentionIntervalIndex,
    ).toBe(0);
  });
  it("a lesson with an error resets recommendation to 14 days", () => {
    let d = finish(begin([words[0]]));
    d = startLesson(d, [words[0]], "dictionary", now, undefined, "again");
    d = finish(d);
    expect(d.progress[words[0].vocabularyId].retentionIntervalIndex).toBe(1);
    d = startLesson(d, [words[0]], "dictionary", now, undefined, "errors");
    d = answer(answer(d), false);
    d = finish(d);
    expect(d.progress[words[0].vocabularyId].retentionIntervalIndex).toBe(0);
  });
});
describe("persistence and migration", () => {
  it("roundtrips pending retries and completed lessons", () => {
    const memory = new Map<string, string>();
    const repo = new LocalUserRepository({
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => {
        memory.set(k, v);
      },
    });
    expect(repo.load()).toEqual(emptyData());
    let d = answer(answer(begin()), false);
    repo.save(d);
    expect(repo.load()).toEqual(d);
    d = finish(repo.load());
    repo.save(d);
    expect(repo.load()).toEqual(d);
  });
  it("protects against duplicate, stale and forged attempts", () => {
    const d = begin();
    const s = d.activeSession!,
      a = s.queue[0];
    const input = {
      id: a.id,
      taskId: a.taskId,
      sessionId: s.id,
      correct: true,
    };
    const once = completeExercise(d, input, now);
    expect(completeExercise(once, input, now)).toBe(once);
    expect(completeExercise(d, { ...input, taskId: "forged" }, now)).toBe(d);
    expect(once.answers).toHaveLength(1);
  });
  it.each([0, 1])(
    "migrates legacy version %i, preserving history and restarting the selected lesson",
    (version) => {
      const id = words[0].vocabularyId;
      const raw = {
        version,
        progress: {
          [id]: {
            vocabularyId: id,
            stage: 7,
            nextReviewAt: now.toISOString(),
            lastReviewedAt: now.toISOString(),
            correctAnswers: 9,
            incorrectAnswers: 2,
            retentionIntervalIndex: 3,
          },
        },
        settings: { dailyLimit: 20, speechEnabled: false, accent: "en-GB" },
        introducedAt: { [id]: now.toISOString() },
        answers: [
          {
            id: "old:0",
            sessionId: "old",
            vocabularyId: id,
            exercise: "context",
            stage: 7,
            correct: true,
            at: now.toISOString(),
          },
        ],
        sessions: [
          {
            id: "old",
            completedAt: now.toISOString(),
            exercises: 1,
            correct: 1,
            incorrect: 0,
            newWords: 1,
          },
        ],
        selectedSets: ["work"],
        activeSession: {
          id: "old",
          mode: "set",
          queue: [id, id, words[1].vocabularyId],
          index: 1,
          startedAt: now.toISOString(),
        },
      };
      const d = migrate(raw);
      expect(d.version).toBe(2);
      expect(d.settings).toEqual({
        quickAddCount: 20,
        speechEnabled: false,
        accent: "en-GB",
      });
      expect(d.progress[id]).toMatchObject({
        status: "learning",
        learnedAt: null,
        correctAnswers: 9,
        incorrectAnswers: 2,
        nextReviewAt: null,
      });
      expect(d.activeSession!.wordIds).toEqual(
        words.map((w) => w.vocabularyId),
      );
      expect(d.activeSession!.index).toBe(0);
      expect(d.answers[0].id).toBe("old:0");
      expect(d.sessions).toHaveLength(1);
      expect(d.migrationNotice).toBe(true);
      expect(migrate({ ...d, migrationNotice: false }).migrationNotice).toBe(
        false,
      );
    },
  );
  it("refuses corrupt and future data without overwriting", () => {
    for (const raw of [
      "{",
      JSON.stringify({ version: 99 }),
      JSON.stringify({ ...emptyData(), progress: { bad: {} } }),
      JSON.stringify({ ...emptyData(), activeSession: {} }),
    ]) {
      let saved = false;
      const repo = new LocalUserRepository({
        getItem: () => raw,
        setItem: () => {
          saved = true;
        },
      });
      expect(() => repo.load()).toThrow();
      expect(saved).toBe(false);
    }
    expect(() => migrate({ version: 3 })).toThrow(UnsupportedStorageVersion);
  });
  it("reports storage quota errors", () => {
    const repo = new LocalUserRepository({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    });
    expect(() => repo.save(emptyData())).toThrow("QuotaExceeded");
  });
});
describe("vocabulary exercises", () => {
  it.each(["hello", "coffee", "boolean", "can't", "a-a", "ice cream"])(
    "shuffles %s preserving punctuation and independent duplicate letters",
    (word) => {
      for (let i = 0; i < 20; i++) {
        const letters = buildLetters(word);
        expect(letters.map((l) => l.value).join("")).not.toBe(word);
        expect(letters.map((l) => l.value).sort()).toEqual([...word].sort());
        expect(new Set(letters.map((l) => l.id)).size).toBe(word.length);
      }
    },
  );
  it("detects letters with no meaningful shuffle", () => {
    expect(canBuild("a")).toBe(false);
    expect(canBuild("aaa")).toBe(false);
  });
  it.each([
    [" COFFEE ", "coffee", true],
    ["ice   cream", "ice cream", true],
    ["can't", "cant", false],
    ["ice-cream", "ice cream", false],
    ["", "coffee", false],
  ])("checks %s against %s", (input, expected, result) =>
    expect(checkAnswer(input as string, expected as string)).toBe(result),
  );
  it("provides four unique options and valid context for every card", () => {
    for (const w of allWords) {
      expect(contextParts(w.example, w.contextAnswer ?? w.word)).not.toBeNull();
      for (const reverse of [true, false]) {
        const choices = choicesFor(w, allWords, reverse);
        expect(choices).toHaveLength(4);
        expect(new Set(choices).size).toBe(4);
        expect(choices).toContain(reverse ? w.word : w.translation);
      }
    }
  });
  it("provides twelve full sets with shared lexical entries and unique card IDs", () => {
    const cards = wordSets.flatMap((s) => s.words);
    expect(wordSets).toHaveLength(12);
    expect(cards).toHaveLength(2610);
    expect(allWords.length).toBeGreaterThan(2000);
    expect(new Set(cards.map((w) => w.id)).size).toBe(cards.length);
    expect(buildSession(emptyData(), cards, "set", now).wordIds).toHaveLength(
      new Set(cards.map((w) => w.vocabularyId)).size,
    );
  });
});

describe("migration writeback and resumed recommendations", () => {
  it("writes version 2 once after validating a legacy payload and retains the notice", () => {
    let raw = JSON.stringify({
      version: 1,
      progress: {},
      settings: { dailyLimit: 15 },
      answers: [],
      sessions: [],
      activeSession: null,
    });
    let writes = 0;
    const repo = new LocalUserRepository({
      getItem: () => raw,
      setItem: (_key, value) => {
        raw = value;
        writes++;
      },
    });
    expect(repo.load().settings.quickAddCount).toBe(15);
    expect(JSON.parse(raw).version).toBe(2);
    expect(repo.load().migrationNotice).toBe(true);
    expect(writes).toBe(1);
  });
  it("keeps the original payload if migration cannot be persisted", () => {
    const raw = JSON.stringify({
      version: 1,
      progress: {},
      activeSession: null,
    });
    const repo = new LocalUserRepository({
      getItem: () => raw,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    });
    expect(() => repo.load()).toThrow("QuotaExceeded");
    expect(JSON.parse(raw).version).toBe(1);
  });
  it("uses 14 days if a word finished before its multiword lesson was interrupted", () => {
    let d = begin();
    for (let i = 0; i < 11; i++) d = answer(d);
    expect(d.progress[words[0].vocabularyId].status).toBe("learned");
    expect(d.progress[words[0].vocabularyId].nextReviewAt).toBeNull();
    d = { ...d, activeSession: null };
    d = finish(
      startLesson(
        d,
        [words[0]],
        "dictionary",
        now,
        undefined,
        "after-interruption",
      ),
    );
    expect(d.progress[words[0].vocabularyId].retentionIntervalIndex).toBe(0);
    expect(
      (Date.parse(d.progress[words[0].vocabularyId].nextReviewAt!) -
        now.getTime()) /
        86400_000,
    ).toBe(14);
  });
});

describe("removing final checks from saved lessons", () => {
  function legacyLesson() {
    const d = begin();
    const s = d.activeSession!;
    for (const word of words)
      for (const [i, exercise] of (
        ["spelling", "builder", "context"] as const
      ).entries())
        s.tasks.push({
          id: `${word.vocabularyId}:${6 + i}`,
          vocabularyId: word.vocabularyId,
          stage: 7,
          exercise,
        });
    return d;
  }
  it("finishes a saved lesson immediately when all six stages are already correct", () => {
    let d = legacyLesson();
    for (let i = 0; i < 12; i++) d = answer(d);
    expect(d.sessions).toHaveLength(0);
    expect(
      Object.values(d.progress).every((p) => p.status === "learning"),
    ).toBe(true);
    const migrated = migrate(d);
    expect(migrated.activeSession!.tasks).toHaveLength(12);
    expect(migrated.activeSession!.index).toBe(
      migrated.activeSession!.queue.length,
    );
    expect(migrated.sessions).toHaveLength(1);
    expect(migrated.sessions[0].learnedWords).toBe(2);
    expect(
      Object.values(migrated.progress).every((p) => p.status === "learned"),
    ).toBe(true);
    expect(migrate(migrated)).toEqual(migrated);
  });
  it("preserves failed main stages and avoids attempt ID collisions after pruning old attempts", () => {
    let d = legacyLesson();
    for (let i = 0; i < 15; i++) {
      const s = d.activeSession!;
      const task = s.tasks.find((t) => t.id === s.queue[s.index].taskId)!;
      d = answer(
        d,
        !(task.vocabularyId === words[1].vocabularyId && task.stage === 6),
      );
    }
    expect(d.answers.some((a) => a.stage === 7)).toBe(true);
    const migrated = migrate(d);
    expect(migrated.progress[words[0].vocabularyId].status).toBe("learned");
    expect(migrated.progress[words[1].vocabularyId].status).toBe("learning");
    expect(migrated.activeSession!.tasks.some((t) => t.stage === 7)).toBe(
      false,
    );
    expect(migrated.answers).toEqual(d.answers);
    const done = finish(migrated);
    expect(done.sessions).toHaveLength(1);
    expect(done.progress[words[1].vocabularyId].status).toBe("learned");
    expect(new Set(done.answers.map((a) => a.id)).size).toBe(
      done.answers.length,
    );
    expect(migrate(done)).toEqual(done);
  });
  it("persists the shortened lesson when loading existing version 2 data", () => {
    const old = legacyLesson();
    let raw = JSON.stringify(old);
    const repo = new LocalUserRepository({
      getItem: () => raw,
      setItem: (_key, value) => {
        raw = value;
      },
    });
    expect(repo.load().activeSession!.tasks).toHaveLength(12);
    expect(JSON.parse(raw).activeSession.tasks).toHaveLength(12);
    expect(repo.load().activeSession!.completedTaskIds).toEqual([]);
  });
});

describe("lesson lifecycle", () => {
  it("ends early once, retains attempts and statuses, and rejects subsequent answers", () => {
    const d = answer(answer(answer(begin())), false);
    const s = d.activeSession!;
    const attempt = s.queue[s.index];
    const ended = endLesson(d, now);
    expect(ended.activeSession!.status).toBe("endedEarly");
    expect(ended.answers).toEqual(d.answers);
    expect(ended.progress).toBe(d.progress);
    expect(ended.sessions).toHaveLength(1);
    expect(ended.sessions[0]).toMatchObject({
      outcome: "endedEarly",
      exercises: 3,
      correct: 0,
      incorrect: 1,
      learnedWords: 0,
    });
    expect(endLesson(ended, now)).toBe(ended);
    expect(
      completeExercise(
        ended,
        {
          id: attempt.id,
          taskId: attempt.taskId,
          sessionId: s.id,
          correct: true,
        },
        now,
      ),
    ).toBe(ended);
    const next = startLesson(ended, words, "dictionary", now, undefined, "new");
    expect(next.activeSession!.status).toBe("active");
    expect(next.activeSession!.index).toBe(0);
    expect(next.activeSession!.completedTaskIds).toEqual([]);
  });
  it("keeps fully learned words but never advances the schedule on early completion", () => {
    let d = begin();
    for (let i = 0; i < 11; i++) d = answer(d);
    const ended = endLesson(d, now);
    expect(ended.progress[words[0].vocabularyId].status).toBe("learned");
    expect(ended.progress[words[1].vocabularyId].status).toBe("learning");
    expect(ended.progress).toBe(d.progress);
    expect(ended.sessions[0]).toMatchObject({
      outcome: "endedEarly",
      learnedWords: 1,
    });
    expect(ended.progress[words[0].vocabularyId].nextReviewAt).toBeNull();
    expect(migrate(ended)).toEqual(ended);
  });
  it("can end an untouched lesson and preserves an existing review schedule", () => {
    let d = finish(begin([words[0]]));
    const schedule = d.progress[words[0].vocabularyId];
    d = startLesson(d, [words[0]], "dictionary", now, undefined, "repeat");
    const ended = endLesson(d, now);
    expect(ended.sessions.at(-1)).toMatchObject({
      outcome: "endedEarly",
      exercises: 0,
    });
    expect(ended.progress[words[0].vocabularyId]).toEqual(schedule);
  });
  it("marks a full lesson completed and cannot later turn it into early completion", () => {
    const done = finish(begin());
    expect(done.activeSession!.status).toBe("completed");
    expect(done.sessions[0].outcome).toBe("completed");
    expect(endLesson(done, now)).toBe(done);
    expect(migrate(done)).toEqual(done);
  });
  it.each([false, true])(
    "infers and persists missing lifecycle fields in saved lessons (completed=%s)",
    (complete) => {
      const d = complete ? finish(begin()) : answer(begin());
      const legacy = JSON.parse(JSON.stringify(d));
      delete legacy.activeSession.status;
      for (const summary of legacy.sessions) delete summary.outcome;
      let raw = JSON.stringify(legacy);
      const repo = new LocalUserRepository({
        getItem: () => raw,
        setItem: (_key, value) => {
          raw = value;
        },
      });
      const restored = repo.load();
      expect(restored.activeSession!.status).toBe(
        complete ? "completed" : "active",
      );
      expect(restored.activeSession!.index).toBe(d.activeSession!.index);
      expect(restored.answers).toEqual(d.answers);
      expect(restored.sessions.every((s) => s.outcome === "completed")).toBe(
        true,
      );
      expect(JSON.parse(raw).activeSession.status).toBe(
        restored.activeSession!.status,
      );
      expect(repo.load()).toEqual(restored);
    },
  );
  it("rejects invalid lifecycle values without silently resurrecting a lesson", () => {
    const d = begin();
    expect(() =>
      migrate({
        ...d,
        activeSession: { ...d.activeSession, status: "paused" },
      }),
    ).toThrow();
    expect(() =>
      migrate({
        ...d,
        activeSession: { ...d.activeSession, status: "completed" },
      }),
    ).toThrow();
    expect(() =>
      migrate({ ...d, sessions: [{ id: "broken", outcome: "paused" }] }),
    ).toThrow();
  });
});

describe("dashboard random word selection", () => {
  it("selects a unique configured portion from learning words only without mutation", () => {
    let d = addWords(emptyData(), allWords.slice(0, 15), now);
    d = { ...d, settings: { ...d.settings, quickAddCount: 5 } };
    d.progress[allWords[0].vocabularyId] = {
      ...d.progress[allWords[0].vocabularyId],
      status: "learned",
      learnedAt: now.toISOString(),
      nextReviewAt: "2020-01-01T00:00:00Z",
    };
    const before = JSON.stringify(d);
    const input = [...allWords, allWords[1], allWords[1]];
    const original = [...input];
    const selected = randomLearningWords(d, input, () => 0);
    expect(selected).toHaveLength(5);
    expect(new Set(selected.map((w) => w.vocabularyId)).size).toBe(5);
    expect(
      selected.every((w) => d.progress[w.vocabularyId]?.status === "learning"),
    ).toBe(true);
    expect(
      selected.some((w) => w.vocabularyId === allWords[0].vocabularyId),
    ).toBe(false);
    expect(selected.map((w) => w.vocabularyId)).not.toEqual(
      allWords.slice(1, 6).map((w) => w.vocabularyId),
    );
    expect(JSON.stringify(d)).toBe(before);
    expect(input).toEqual(original);
  });
  it("returns all eligible words if fewer than the configured count exist", () => {
    const d = addWords(emptyData(), allWords.slice(0, 3), now);
    d.settings.quickAddCount = 30;
    expect(randomLearningWords(d, allWords)).toHaveLength(3);
  });
  it("uses 10 by default and does not fall back to learned or missing words", () => {
    const d = addWords(emptyData(), allWords.slice(0, 15), now);
    expect(randomLearningWords(d, allWords)).toHaveLength(10);
    for (const p of Object.values(d.progress)) {
      p.status = "learned";
      p.learnedAt = now.toISOString();
    }
    expect(randomLearningWords(d, allWords)).toEqual([]);
    expect(randomLearningWords(emptyData(), allWords)).toEqual([]);
  });
});

describe("dashboard review selection", () => {
  it("prioritizes overdue words, sorts remaining practice dates, deduplicates and respects N", () => {
    const pool = allWords.slice(0, 8);
    const data = addWords(emptyData(), pool);
    const dates = [
      "2026-11-03",
      "2026-11-01",
      "2026-10-01",
      "2026-09-01",
      "2026-08-01",
      "2026-07-01",
      "2026-06-01",
    ];
    pool.slice(0, 7).forEach((word, index) => {
      const p = data.progress[word.vocabularyId];
      p.status = "learned";
      p.learnedAt = dates[index] + "T00:00:00Z";
    });
    data.progress[pool[0].vocabularyId].nextReviewAt = "2026-11-02T00:00:00Z";
    data.progress[pool[1].vocabularyId].nextReviewAt = "2026-11-01T00:00:00Z";
    data.progress[pool[2].vocabularyId].lastReviewedAt = "2026-11-04T00:00:00Z";
    data.progress[pool[3].vocabularyId].nextReviewAt = "2027-01-01T00:00:00Z";
    data.settings.quickAddCount = 5;
    expect(
      reviewLessonWords(data, [...pool, pool[1]], now).map(
        (w) => w.vocabularyId,
      ),
    ).toEqual(
      [pool[1], pool[0], pool[6], pool[5], pool[4]].map((w) => w.vocabularyId),
    );
    data.settings.quickAddCount = 10;
    expect(reviewLessonWords(data, pool, now)).toHaveLength(7);
    data.progress[pool[4].vocabularyId].learnedAt =
      data.progress[pool[5].vocabularyId].learnedAt;
    const result = reviewLessonWords(data, pool, now);
    const tied = result
      .filter((w) =>
        [pool[4].vocabularyId, pool[5].vocabularyId].includes(w.vocabularyId),
      )
      .map((w) => w.vocabularyId);
    expect(tied).toEqual([...tied].sort((a, b) => a.localeCompare(b)));
  });
});

describe("context answer choices", () => {
  it("provides four case-insensitively unique answers for every catalog word", () => {
    for (const word of allWords) {
      const options = contextChoicesFor(word);
      expect(options, word.word).toHaveLength(4);
      expect(options, word.word).toContain(word.contextAnswer ?? word.word);
      expect(new Set(options.map((option) => option.toLowerCase())).size).toBe(
        4,
      );
    }
  });
  it("shuffles only the authored alternatives and uses the context answer form", () => {
    const word = {
      ...allWords[0],
      vocabularyId: "test-context",
      word: "month",
      contextAnswer: "months",
      contextDistractors: ["although", "unless", "because"],
    };
    for (const random of [() => 0, () => 0.5, () => 0.99])
      expect(new Set(contextChoicesFor(word, random))).toEqual(
        new Set(["months", "although", "unless", "because"]),
      );
    expect(contextChoicesFor(word, () => 0)).not.toEqual(
      contextChoicesFor(word, () => 0.99),
    );
  });
  it("rejects missing, duplicate and empty prepared alternatives without random fallback", () => {
    for (const alternatives of [
      [],
      ["one", "two"],
      ["same", "SAME", "other"],
      ["", "two", "three"],
      [allWords[0].contextAnswer ?? allWords[0].word, "two", "three"],
    ])
      expect(() =>
        contextChoicesFor({ ...allWords[0], contextDistractors: alternatives }),
      ).toThrow("Invalid prepared context choices");
  });
});

describe("accepted spelling variants", () => {
  it.each([
    ["colour-noun-1", " COLOR ", true],
    ["organization-noun-1", "organisation", true],
    ["i-don-t-know-phrase-1", "I   do not know", true],
    ["begin-verb-1", "start", true],
    ["autumn-noun-1", "fall", true],
    ["fall-verb-1", "autumn", false],
    ["holiday-noun-public-day", "vacation", false],
    ["job-noun-1", "work", false],
    ["miss-verb-1", "skip", false],
    ["colour-noun-1", "colur", false],
    ["colour-noun-1", "", false],
  ])("%s accepts %s = %s", (id, input, valid) => {
    const word = allWords.find((word) => word.vocabularyId === id)!;
    expect(word).toBeTruthy();
    expect(checkSpellingAnswer(input, word)).toBe(valid);
  });
  it("never offers accepted English synonyms as wrong reverse choices", () => {
    const target = allWords.find(
      (word) => word.vocabularyId === "big-adjective-1",
    )!;
    const related = allWords.find(
      (word) => word.vocabularyId === "large-adjective-1",
    )!;
    for (const reverse of [true, false]) {
      const options = choicesFor(
        target,
        [target, related, ...allWords],
        reverse,
        () => 0.5,
      );
      expect(options).toHaveLength(4);
      expect(options).not.toContain(
        reverse ? related.word : related.translation,
      );
    }
  });
});
