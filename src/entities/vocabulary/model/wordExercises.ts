import { normalizeAnswer, shuffle } from "../../../shared/lib";
export const checkAnswer = (value: string, expected: string) =>
  normalizeAnswer(value) === normalizeAnswer(expected);
export interface Letter {
  id: string;
  value: string;
}
export const canBuild = (word: string) => new Set([...word]).size > 1;
export function buildLetters(word: string, random = Math.random): Letter[] {
  const letters = [...word].map((value, i) => ({ id: `letter-${i}`, value }));
  if (!canBuild(word)) return letters;
  const result = shuffle(letters, random);
  if (result.map((l) => l.value).join("") === word) {
    const j = result.findIndex((l) => l.value !== result[0].value);
    [result[0], result[j]] = [result[j], result[0]];
  }
  return result;
}
export function contextParts(
  example: string,
  answer: string,
): [string, string] | null {
  const lower = example.toLowerCase(),
    needle = answer.toLowerCase();
  let start = lower.indexOf(needle);
  while (start >= 0) {
    const before = example[start - 1],
      after = example[start + answer.length];
    if (
      (!before || !/[a-z]/i.test(before)) &&
      (!after || !/[a-z]/i.test(after))
    )
      return [example.slice(0, start), example.slice(start + answer.length)];
    start = lower.indexOf(needle, start + 1);
  }
  return null;
}
