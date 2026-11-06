import savedWords from "../../../data/compatibility-words.json";
import calendar from "../../../data/sets/days-months-seasons-80.json";
import emotions from "../../../data/sets/emotions-150.json";
import everyday from "../../../data/sets/everyday-300.json";
import food from "../../../data/sets/food-200.json";
import irregular from "../../../data/sets/irregular-verbs-180.json";
import numbers from "../../../data/sets/numbers-time-100.json";
import questions from "../../../data/sets/questions-communication-100.json";
import shopping from "../../../data/sets/shopping-200.json";
import technology from "../../../data/sets/technology-250.json";
import top from "../../../data/sets/top-500.json";
import travel from "../../../data/sets/travel-250.json";
import work from "../../../data/sets/work-300.json";
import { uniqueWords } from "./sessionBuilder";
import type { Word, WordSet } from "./types";
// Individual retired entries remain resolvable for saved dictionaries and lessons.
export const compatibilityWords: Word[] = savedWords;
export const wordSets: WordSet[] = [
  top,
  numbers,
  calendar,
  everyday,
  questions,
  food,
  shopping,
  travel,
  emotions,
  irregular,
  work,
  technology,
];
export const legacySetIds: Record<string, string> = {
  everyday: everyday.id,
  work: work.id,
  travel: travel.id,
  food: food.id,
  programming: technology.id,
};
export const resolveSetId = (id: string) => legacySetIds[id] ?? id;
export const allWords = uniqueWords([
  ...everyday.words,
  ...wordSets.flatMap((set) => set.words),
  ...compatibilityWords,
]);
export const wordById = new Map(allWords.map((w) => [w.vocabularyId, w]));
export const setById = (id: string) =>
  wordSets.find((set) => set.id === resolveSetId(id));
