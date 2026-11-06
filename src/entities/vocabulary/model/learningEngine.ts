import { normalizeAnswer, shuffle } from "../../../shared/lib";
import type { Exercise, LessonTask, Word } from "./types";
import { canBuild, checkAnswer } from "./wordExercises";
export const STAGE_NAMES = [
  "Знакомство",
  "Узнавание",
  "Обратный перевод",
  "Конструктор",
  "Написание",
  "Контекст",
];
export function tasksFor(word: Word): LessonTask[] {
  const exercises: Exercise[] = [
    "introduction",
    "recognition",
    "reverse",
    "builder",
    "spelling",
    "context",
  ];
  return exercises.flatMap((exercise, index) =>
    exercise === "builder" && !canBuild(word.word)
      ? []
      : [
          {
            id: `${word.vocabularyId}:${index}`,
            vocabularyId: word.vocabularyId,
            stage: (index + 1) as LessonTask["stage"],
            exercise,
          },
        ],
  );
}
// Vocabulary assets are immutable; cache normalized equivalence lists across lessons.
const equivalenceCache = new WeakMap<
  Word,
  { answers: string[]; translations: string[] }
>();
function wordEquivalence(word: Word) {
  let cached = equivalenceCache.get(word);
  if (!cached) {
    cached = {
      answers: word.acceptedAnswers.map(normalizeAnswer),
      translations: [word.translation, ...word.alternativeTranslations].map(
        normalizeAnswer,
      ),
    };
    equivalenceCache.set(word, cached);
  }
  return cached;
}
export function choicesFor(
  word: Word,
  all: Word[],
  reverse: boolean,
  random = Math.random,
): string[] {
  const field = reverse ? "word" : "translation";
  const equivalent = wordEquivalence(word);
  const targetAnswers = new Set(equivalent.answers);
  const targetTranslations = new Set(equivalent.translations);
  const distractors = [
    ...new Set(
      all
        .filter((w) => {
          if (w.vocabularyId === word.vocabularyId) return false;
          const candidate = wordEquivalence(w);
          if (candidate.answers.some((answer) => targetAnswers.has(answer)))
            return false;
          return (
            reverse ||
            !candidate.translations.some((translation) =>
              targetTranslations.has(translation),
            )
          );
        })
        .map((w) => w[field]),
    ),
  ].filter((v) => v !== word[field]);
  return shuffle(
    [word[field], ...shuffle(distractors, random).slice(0, 3)],
    random,
  );
}

/** Only the order changes: alternatives belong to the specific example in the data. */
export function contextChoicesFor(word: Word, random = Math.random): string[] {
  const options = [word.contextAnswer ?? word.word, ...word.contextDistractors];
  const normalized = options.map((option) => option.trim().toLowerCase());
  if (
    options.length !== 4 ||
    normalized.some((option) => !option) ||
    new Set(normalized).size !== 4
  )
    throw new Error(`Invalid prepared context choices: ${word.vocabularyId}`);
  return shuffle(options, random);
}

/** Alternatives apply only to free-text spelling, never to letter assembly or context. */
export function checkSpellingAnswer(value: string, word: Word): boolean {
  return word.acceptedAnswers.some((expected) => checkAnswer(value, expected));
}
