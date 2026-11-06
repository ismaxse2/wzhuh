import { describe, expect, it } from "vitest";

import { compatibilityWords, wordSets } from "./vocabularyService";

const cards = [...wordSets.flatMap((set) => set.words), ...compatibilityWords];
const card = (example: string) => {
  const result = cards.find((word) => word.example === example);
  expect(result, example).toBeDefined();
  return result!;
};
const gloss = (example: string, text: string) => {
  const token = card(example).exampleTokens?.find((part) => part.text === text);
  expect(token, `${example}: ${text}`).toBeDefined();
  return token!.translation;
};

// Editorial regressions: these expected meanings were checked against the
// specific sentences. Structural validation alone cannot assess translations.
describe("contextual meanings in the edited corpus", () => {
  it.each([
    ["Can you help me?", "help", "помочь"],
    ["I need some help.", "help", "помощь"],
    ["Does he live here?", "Does", "вспомогательный глагол вопроса"],
    ["What did you say?", "did", "вспомогательный глагол вопроса"],
    ["Do not break the glass.", "Do", "вспомогательный глагол отрицания"],
    ["Please do your homework first.", "do", "сделай"],
    ["Please do your homework first.", "first", "сначала"],
    ["She is starting a career in medicine.", "starting", "начинает"],
    ["She is starting a career in medicine.", "medicine", "медицине"],
    ["Mark the starting point on the map.", "starting", "начальную"],
    ["Take your medicine after lunch.", "medicine", "лекарство"],
    ["Take your medicine after lunch.", "Take", "принимай"],
    ["They cast their fishing lines into the lake.", "cast", "забрасывают"],
    ["I dream of travelling around the world.", "dream", "мечтаю"],
    ["Do not spit on the ground.", "ground", "землю"],
    ["Waves beat against the rocks.", "beat", "бьются"],
    ["Do not strike the glass with a hammer.", "strike", "бейте"],
    ["I swear to tell the truth.", "swear", "клянусь"],
    ["Wind the string around the stick.", "string", "верёвку"],
    ["Wind the string around the stick.", "stick", "палку"],
    ["Please send me the minutes of the meeting.", "minutes", "протокол"],
    ["The house is in a poor state.", "poor", "плохом"],
    ["The charity helps poor families.", "poor", "бедным"],
    ["Your photo received a like from my sister.", "like", "лайк"],
    ["Can I book a room for two nights?", "book", "забронировать"],
    ["She is on parental leave.", "leave", "отпуске"],
    ["The train leaves at six.", "leaves", "отправляется"],
    ["Leaves fall in October.", "Leaves", "листья"],
    [
      "The printer has run out of paper.",
      "has",
      "вспомогательный глагол перфекта: действие связано с результатом",
    ],
    ["We meet on Tuesday.", "meet", "встречаемся"],
    ["I work on Monday.", "work", "работаю"],
    ["We train twice a week.", "train", "тренируемся"],
    ["We train twice a week.", "twice", "два раза"],
    ["My birthday is in May.", "May", "мае"],
    ["Please cut this paragraph from the document.", "cut", "вырежьте"],
    ["I try to learn something new every day.", "try", "стараюсь; пытаюсь"],
  ])("%s: %s has its sentence-specific meaning", (example, text, meaning) => {
    expect(gloss(example, text)).toBe(meaning);
  });

  it("explains idioms instead of assigning unrelated literal meanings", () => {
    expect(gloss("She carried a lot of guilt.", "of")).toBe(
      "часть сочетания «много»",
    );
    expect(gloss("The train arrived on time.", "on")).toBe(
      "часть сочетания «вовремя»",
    );
    expect(gloss("Of course I can help.", "Of")).toBe(
      "часть сочетания «конечно»",
    );
    expect(gloss("A little kindness goes a long way.", "way")).toBe(
      "часть выражения «много значит»",
    );
    expect(gloss("They weave cloth by hand.", "by")).toBe(
      "часть сочетания «вручную»",
    );
  });

  it.each([
    ["I need to buy bread today.", "Мне нужно купить хлеб сегодня."],
    [
      "You can unsubscribe from the newsletter.",
      "Вы можете отписаться от рассылки.",
    ],
    ["I have a headache.", "У меня болит голова."],
    [
      "There was an accident on the road.",
      "На дороге произошёл несчастный случай.",
    ],
    ["This dish is salty.", "Это блюдо солёное."],
    ["Where are the stairs?", "Где лестница?"],
    ["I need a one-way ticket.", "Мне нужен билет в одну сторону."],
    [
      "Our team will discuss the plan today.",
      "Наша команда обсудит план сегодня.",
    ],
  ])(
    "keeps the edited English and Russian example together: %s",
    (example, translation) => {
      expect(card(example).exampleTranslation).toBe(translation);
    },
  );

  it("does not leave placeholder glosses in catalog or compatibility data", () => {
    for (const word of cards)
      for (const token of word.exampleTokens ?? [])
        expect(
          token.translation,
          `${word.vocabularyId}: ${token.text}`,
        ).not.toBe("по контексту");
  });
});
