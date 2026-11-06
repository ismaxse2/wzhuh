import { describe, expect, it } from "vitest";

import { contextSegments } from "./contextSentence";
import { tasksFor } from "./learningEngine";
import { migrate } from "./storage/migrations";
import { addWords, emptyData, startLesson } from "./storage/model";
import type { Word, WordSet } from "./types";
import {
  compatibilityWords,
  setById,
  wordById,
  wordSets,
} from "./vocabularyService";
import { contextParts } from "./wordExercises";

const files = import.meta.glob<WordSet>("../../../data/sets/*.json", {
  eager: true,
  import: "default",
});
const entries = Object.entries(files).map(([path, set]) => ({
  name: path.split("/").at(-1)!,
  set,
}));
const drafts = entries;
const content = (word: Word) => ({
  word: word.word,
  translation: word.translation,
  alternativeTranslations: word.alternativeTranslations,
  acceptedAnswers: word.acceptedAnswers,
  partOfSpeech: word.partOfSpeech,
  transcription: word.transcription,
  example: word.example,
  exampleTranslation: word.exampleTranslation,
  contextAnswer: word.contextAnswer,
  contextDistractors: word.contextDistractors,
  exampleTokens: word.exampleTokens,
});

describe("all vocabulary files, including legacy compatibility data", () => {
  it("uses unique set and card IDs without changing the published vocabulary", () => {
    expect(new Set(entries.map(({ set }) => set.id)).size).toBe(entries.length);
    const cards = entries.flatMap(({ set }) => set.words);
    expect(new Set(cards.map((word) => word.id)).size).toBe(cards.length);
    expect(drafts).toHaveLength(12);
    expect(drafts.reduce((sum, { set }) => sum + set.words.length, 0)).toBe(
      2610,
    );
  });
  for (const { name, set } of drafts) {
    it(`${name}: has complete fields, exact tokens and one hidden answer per example`, () => {
      expect(set.words.length).toBe(Number(name.match(/-(\d+)\.json$/)![1]));
      expect(new Set(set.words.map((word) => word.vocabularyId)).size).toBe(
        set.words.length,
      );
      for (const word of set.words) {
        const label = `${name}: ${word.word}`;
        for (const key of [
          "id",
          "vocabularyId",
          "word",
          "translation",
          "partOfSpeech",
          "transcription",
          "example",
          "exampleTranslation",
        ] as const)
          expect(word[key].trim().length, `${label}: ${key}`).toBeGreaterThan(
            0,
          );
        expect(word.transcription, label).toMatch(/^\/[^?]+\/$/);
        expect(word.translation, label).toMatch(/[а-яё]/i);
        expect(word.example, label).not.toMatch(
          /^(I know the word |The past tense of |We discussed the |I use the .+ every day\.|I hear .+ often\.)/,
        );
        expect(word.exampleTranslation, label).toMatch(/[а-яё]/i);
        const answer = word.contextAnswer ?? word.word;
        const parts = contextParts(word.example, answer);
        expect(parts, label).not.toBeNull();
        expect(
          contextParts(parts!.join(" "), answer),
          `${label}: visible answer leak`,
        ).toBeNull();
        expect(
          word.exampleTokens!.map((token) => token.text).join(""),
          label,
        ).toBe(word.example);
        for (const token of word.exampleTokens!) {
          if (/[a-z]/i.test(token.text))
            expect(token.translation, `${label}: ${token.text}`).toMatch(
              /[а-яё]/i,
            );
        }
        expect(contextSegments(word), label).not.toBeNull();
        expect(tasksFor(word).at(-1)?.exercise, label).toBe("context");
      }
    });
  }
  it("gives shared vocabulary IDs identical learning content across catalog sets", () => {
    const canonical = new Map<string, ReturnType<typeof content>>();
    for (const { set } of drafts)
      for (const word of set.words) {
        if (canonical.has(word.vocabularyId))
          expect(content(word), word.vocabularyId).toEqual(
            canonical.get(word.vocabularyId),
          );
        else canonical.set(word.vocabularyId, content(word));
      }
  });
  it("separates different senses and keeps irregular verb forms with real usage examples", () => {
    const words = drafts.flatMap(({ set }) => set.words);
    const id = (word: string, translation: string) =>
      words.find((w) => w.word === word && w.translation === translation)!
        .vocabularyId;
    expect(id("miss", "скучать")).not.toBe(id("miss", "опоздать на"));
    expect(id("interest", "интерес")).not.toBe(id("interest", "процент"));
    expect(id("cookie", "печенье")).not.toBe(id("cookie", "файл cookie"));
    const irregular = drafts.find(
      ({ name }) => name === "irregular-verbs-180.json",
    )!.set;
    for (const word of irregular.words) {
      expect(word).toHaveProperty("pastSimple");
      expect(word).toHaveProperty("pastParticiple");
      expect(word.example).not.toMatch(/^The past tense of /);
    }
  });
});

describe("full catalog rollout compatibility", () => {
  it("exposes only the twelve full sets and resolves old links", () => {
    expect(wordSets).toHaveLength(12);
    expect(wordSets.reduce((sum, set) => sum + set.words.length, 0)).toBe(2610);
    expect(wordSets.every((set) => /-\d+$/.test(set.id))).toBe(true);
    expect(setById("everyday")?.id).toBe("everyday-300");
    expect(setById("programming")?.id).toBe("technology-250");
  });
  it("preserves old vocabulary and active lessons while mapping selected sets", () => {
    const word = compatibilityWords[0];
    let data = addWords(emptyData(), [word]);
    data = startLesson(data, [word]);
    data.selectedSets = ["everyday", "food", "programming", "food-200"];
    const migrated = migrate(data);
    expect(migrated.selectedSets).toEqual([
      "everyday-300",
      "food-200",
      "technology-250",
    ]);
    expect(migrated.progress).toEqual(data.progress);
    expect(migrated.answers).toEqual(data.answers);
    expect(migrated.activeSession).toEqual(data.activeSession);
    for (const oldWord of compatibilityWords)
      expect(wordById.has(oldWord.vocabularyId)).toBe(true);
  });
});

it("orders the catalog from basic to advanced with the top 500 first", () => {
  expect(wordSets.map((set) => set.id)).toEqual([
    "top-500",
    "numbers-time-100",
    "days-months-seasons-80",
    "everyday-300",
    "questions-communication-100",
    "food-200",
    "shopping-200",
    "travel-250",
    "emotions-150",
    "irregular-verbs-180",
    "work-300",
    "technology-250",
  ]);
  expect(wordSets[0].words).toHaveLength(500);
});

it("has three prepared alternatives for every catalog and compatibility card", () => {
  const cards = [
    ...wordSets.flatMap((set) => set.words),
    ...compatibilityWords,
  ];
  expect(cards).toHaveLength(2620);
  for (const word of cards) {
    const label = word.vocabularyId;
    expect(word.contextDistractors, label).toHaveLength(3);
    const options = [
      word.contextAnswer ?? word.word,
      ...word.contextDistractors,
    ];
    expect(
      options.every((option) => option.trim() && /[a-z]/i.test(option)),
      label,
    ).toBe(true);
    expect(
      new Set(options.map((option) => option.trim().toLowerCase())).size,
      label,
    ).toBe(4);
  }
});

it("validates alternative translations and accepted answers across all cards", () => {
  const cards = [
    ...wordSets.flatMap((set) => set.words),
    ...compatibilityWords,
  ];
  const normalized = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();
  for (const word of cards) {
    const label = word.vocabularyId;
    expect(Array.isArray(word.alternativeTranslations), label).toBe(true);
    expect(
      word.alternativeTranslations.every(
        (value) => value.trim() && /[а-яё]/i.test(value),
      ),
      label,
    ).toBe(true);
    const translations = [
      word.translation,
      ...word.alternativeTranslations,
    ].map(normalized);
    expect(new Set(translations).size, label).toBe(translations.length);
    expect(word.acceptedAnswers.length, label).toBeGreaterThan(0);
    expect(word.acceptedAnswers.map(normalized), label).toContain(
      normalized(word.word),
    );
    expect(
      word.acceptedAnswers.every(
        (value) => value.trim() && /[a-z]/i.test(value),
      ),
      label,
    ).toBe(true);
    const accepted = word.acceptedAnswers.map(normalized);
    expect(new Set(accepted).size, label).toBe(accepted.length);
    for (const distractor of word.contextDistractors)
      expect(accepted, label).not.toContain(normalized(distractor));
  }
});
