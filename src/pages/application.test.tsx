// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Layout } from "../app/layout/Layout";
import { VocabularyProvider } from "../app/VocabularyProvider";
import {
  addWords,
  allWords,
  completeExercise,
  emptyData,
  startLesson,
  storageService,
  type UserData,
  wordById,
  wordSets,
} from "../entities/vocabulary";
import { DashboardPage } from "./DashboardPage";
import { DictionaryPage } from "./DictionaryPage";
import { LearningPage } from "./LearningPage";
import { ProfilePage } from "./ProfilePage";
import { ProgressPage } from "./ProgressPage";
import { SettingsPage } from "./SettingsPage";
import { WordsPage } from "./WordsPage";

const word = allWords.find((w) => w.word === "coffee")!;
function answer(data: UserData, correct = true) {
  const s = data.activeSession!,
    a = s.queue[s.index];
  return completeExercise(data, {
    id: a.id,
    taskId: a.taskId,
    sessionId: s.id,
    correct,
  });
}
function setup(taskIndex = 0) {
  let d = startLesson(
    emptyData(),
    [word],
    "dictionary",
    new Date(),
    undefined,
    "ui",
  );
  for (let i = 0; i < taskIndex; i++) d = answer(d);
  storageService.save(d);
}
function mount(path = "/words/learn") {
  return render(
    <VocabularyProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/words/learn" element={<LearningPage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/words" element={<WordsPage />} />
          <Route path="/profile" element={<ProfilePage />}>
            <Route index element={<ProgressPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </VocabularyProvider>,
  );
}
async function solve(user: ReturnType<typeof userEvent.setup>) {
  const s = storageService.load().activeSession!;
  const task = s.tasks.find((t) => t.id === s.queue[s.index].taskId)!;
  const w = wordById.get(task.vocabularyId)!;
  if (task.exercise === "introduction") {
    await user.click(screen.getByRole("button", { name: "Продолжить" }));
    return;
  } else {
    if (
      task.exercise === "recognition" ||
      task.exercise === "reverse" ||
      task.exercise === "context"
    )
      await user.click(
        screen.getByRole("button", {
          name: new RegExp(
            task.exercise === "recognition"
              ? w.translation
              : task.exercise === "context"
                ? (w.contextAnswer ?? w.word)
                : w.word,
          ),
        }),
      );
    else if (task.exercise === "builder") {
      for (const letter of w.word) {
        const buttons = screen.getAllByRole("button", {
          name: `Добавить букву ${letter}`,
        });
        await user.click(
          buttons.find((b) => !(b as HTMLButtonElement).disabled)!,
        );
      }
    } else
      await user.type(screen.getByLabelText("Ваш ответ на английском"), w.word);
    await user.click(screen.getByRole("button", { name: "Проверить ответ" }));
  }
  expect(screen.queryByRole("status")).toBeNull();
}
beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());
describe("full lesson UI", () => {
  it("shows context translations without changing answers or revealing the blank, then completes normally", async () => {
    const user = userEvent.setup();
    setup(5);
    mount();
    const before = storageService.load();
    expect(
      screen.queryByRole("button", { name: "Перевод слова coffee" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Перевод слова I" }));
    expect(screen.getByRole("tooltip").textContent).toBe("я");
    expect(storageService.load()).toEqual(before);
    await user.click(
      screen.getByRole("button", { name: "Перевод слова would" }),
    );
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip").textContent).toBe(
      "бы: вежливая просьба",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^\d+\s*coffee$/ }));
    await user.click(screen.getByRole("button", { name: "Проверить ответ" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Урок завершён!" }),
    ).toBeTruthy();
    expect(storageService.load().answers).toHaveLength(
      before.answers.length + 1,
    );
    expect(storageService.load().progress[word.vocabularyId].status).toBe(
      "learned",
    );
  });

  it("moves directly between introductions and then recognition without a success banner", async () => {
    const user = userEvent.setup();
    const second = allWords.find((w) => w.word === "hello")!;
    storageService.save(startLesson(emptyData(), [word, second]));
    mount();
    await user.click(screen.getByRole("button", { name: "Продолжить" }));
    expect(screen.getByRole("heading", { name: "hello" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(storageService.load().answers).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Продолжить" }));
    expect(screen.getByText("Выберите перевод")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(storageService.load().answers).toHaveLength(2);
  });

  it("finishes all six stages and immediately starts a full replay", async () => {
    const user = userEvent.setup();
    setup();
    mount();
    for (let i = 0; i < 6; i++) await solve(user);
    expect(
      screen.getByRole("heading", { name: "Урок завершён!" }),
    ).toBeTruthy();
    expect(storageService.load().progress[word.vocabularyId].status).toBe(
      "learned",
    );
    expect(storageService.load().sessions[0].learnedWords).toBe(1);
    await user.click(screen.getByRole("link", { name: "Повторить" }));
    expect(screen.getByRole("heading", { name: "coffee" })).toBeTruthy();
    expect(storageService.load().activeSession!.completedTaskIds).toHaveLength(
      0,
    );
    expect(storageService.load().activeSession!.tasks).toHaveLength(6);
  }, 15000);
  it.each([1, 2])("checks recognition task %i", async (index) => {
    const user = userEvent.setup();
    setup(index);
    mount();
    await solve(user);
    expect(storageService.load().activeSession!.completedTaskIds).toHaveLength(
      index + 1,
    );
  });
  it("supports repeated builder letters, removal, reset and a counted retry", async () => {
    const user = userEvent.setup();
    setup(3);
    mount();
    await user.click(screen.getByRole("button", { name: "Добавить букву c" }));
    await user.click(screen.getByRole("button", { name: "Убрать букву c" }));
    expect(
      within(screen.getByLabelText("Собранное слово")).queryAllByRole("button"),
    ).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Добавить букву c" }));
    await user.click(screen.getByRole("button", { name: /Сбросить буквы/ }));
    expect(
      within(screen.getByLabelText("Собранное слово")).queryAllByRole("button"),
    ).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Добавить букву c" }));
    await user.click(screen.getByRole("button", { name: "Проверить ответ" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Правильный ответ:",
    );
    await user.click(screen.getByRole("button", { name: "Продолжить урок" }));
    expect(screen.queryByRole("status")).toBeNull();
    await solve(user);
    const d = storageService.load();
    expect(d.answers).toHaveLength(5);
    expect(d.answers.at(-2)!.correct).toBe(false);
    expect(d.answers.at(-1)!.correct).toBe(true);
    expect(d.answers.at(-1)!.taskId).toBe(d.answers.at(-2)!.taskId);
    expect(d.answers.at(-1)!.id).not.toBe(d.answers.at(-2)!.id);
  });
  it.each([4])("checks spelling task %i with Enter", async (index) => {
    const user = userEvent.setup();
    setup(index);
    mount();
    const input = screen.getByLabelText("Ваш ответ на английском");
    expect((input as HTMLInputElement).value).toBe("");
    if (index === 5) expect(screen.getByText("________")).toBeTruthy();
    await user.type(input, "  COFFEE  {Enter}");
    expect(screen.queryByRole("status")).toBeNull();
    expect(storageService.load().activeSession!.index).toBe(index + 1);
    expect(storageService.load().activeSession!.completedTaskIds).toHaveLength(
      index + 1,
    );
  });
  it("does not double-process an answer", async () => {
    const user = userEvent.setup();
    setup();
    mount();
    await user.dblClick(screen.getByRole("button", { name: "Продолжить" }));
    expect(storageService.load().answers).toHaveLength(1);
  });
  it("restores a pending retry after refresh", async () => {
    const user = userEvent.setup();
    setup(4);
    const view = mount();
    await user.type(
      screen.getByLabelText("Ваш ответ на английском"),
      "wrong{Enter}",
    );
    view.unmount();
    mount();
    expect(
      (screen.getByLabelText("Ваш ответ на английском") as HTMLInputElement)
        .value,
    ).toBe("");
    expect(screen.queryByRole("status")).toBeNull();
    await user.type(
      screen.getByLabelText("Ваш ответ на английском"),
      "coffee{Enter}",
    );
    expect(storageService.load().answers).toHaveLength(6);
  });
  it("finishes early with saved results instead of pausing or discarding the lesson", async () => {
    const user = userEvent.setup();
    setup(2);
    mount();
    expect(screen.queryByRole("link", { name: /Пауза/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Завершить урок" }));
    expect(
      screen.getByRole("heading", { name: "Урок завершён досрочно" }),
    ).toBeTruthy();
    expect(storageService.load().activeSession!.status).toBe("endedEarly");
    expect(storageService.load().sessions[0].outcome).toBe("endedEarly");
    expect(storageService.load().answers).toHaveLength(2);
    expect(storageService.load().progress[word.vocabularyId].status).toBe(
      "learning",
    );
    await user.click(screen.getByRole("link", { name: "Повторить" }));
    expect(storageService.load().activeSession!.index).toBe(0);
    expect(storageService.load().activeSession!.status).toBe("active");
    expect(screen.getByRole("heading", { name: "coffee" })).toBeTruthy();
  });
  it("disables speech buttons safely without browser speech support", () => {
    setup();
    mount();
    expect(
      (screen.getByRole("button", { name: "Прослушать" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
describe("dictionary, adding and settings", () => {
  it("filters by status and translation, selects words and starts their full lesson", async () => {
    const user = userEvent.setup();
    const d = addWords(emptyData(), [word, allWords[0]]);
    d.progress[word.vocabularyId] = {
      ...d.progress[word.vocabularyId],
      status: "learned",
      learnedAt: new Date().toISOString(),
      nextReviewAt: "2099-01-01T00:00:00Z",
    };
    storageService.save(d);
    mount("/dictionary");
    await user.click(screen.getByRole("button", { name: /Изучены/ }));
    expect(screen.queryByText(allWords[0].word)).toBeNull();
    await user.type(screen.getByLabelText("Поиск по словарю"), "кофе");
    await user.click(screen.getByLabelText("Выбрать видимые"));
    await user.click(screen.getByRole("button", { name: "Учить выбранные" }));
    expect(screen.getByRole("heading", { name: "coffee" })).toBeTruthy();
    expect(storageService.load().activeSession!.wordIds).toEqual([
      word.vocabularyId,
    ]);
  });
  it("retains selected words across filters and allows clearing the selection", async () => {
    const user = userEvent.setup();
    storageService.save(addWords(emptyData(), [word, allWords[0]]));
    mount("/dictionary");
    await user.click(screen.getByLabelText("Выбрать coffee"));
    await user.type(screen.getByLabelText("Поиск по словарю"), "hello");
    expect(screen.getByText("Выбрано: 1")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Снять выбор" }));
    expect(
      screen.queryByRole("region", { name: "Выбранные слова" }),
    ).toBeNull();
  });
  it("changes quick count without shrinking the active lesson, saves speech settings and confirms reset", async () => {
    const user = userEvent.setup();
    storageService.save(startLesson(emptyData(), wordSets[0].words));
    mount("/profile/settings");
    await user.click(screen.getByRole("button", { name: "5 слов за раз" }));
    expect(storageService.load().settings.quickAddCount).toBe(5);
    expect(storageService.load().activeSession!.wordIds).toHaveLength(
      wordSets[0].words.length,
    );
    await user.click(screen.getByRole("switch"));
    expect(storageService.load().settings.speechEnabled).toBe(false);
    await user.selectOptions(
      screen.getByLabelText("Вариант произношения"),
      "en-GB",
    );
    expect(storageService.load().settings.accent).toBe("en-GB");
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    expect(Object.keys(storageService.load().progress)).toHaveLength(
      wordSets[0].words.length,
    );
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await user.click(
      screen.getByRole("button", { name: "Да, удалить данные" }),
    );
    expect(storageService.load()).toEqual(emptyData());
  });
  it("shows migration notice once and persists its dismissal", async () => {
    const user = userEvent.setup();
    const d = emptyData();
    d.migrationNotice = true;
    storageService.save(d);
    const view = render(
      <VocabularyProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </VocabularyProvider>,
    );
    expect(screen.getByText(/Теперь все стадии/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Понятно" }));
    expect(storageService.load().migrationNotice).toBe(false);
    view.unmount();
    render(
      <VocabularyProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </VocabularyProvider>,
    );
    expect(screen.queryByText(/Теперь все стадии/)).toBeNull();
  });
});
describe("pages", () => {
  it.each([
    ["/", DashboardPage],
    ["/words", WordsPage],
    ["/dictionary", DictionaryPage],
    ["/profile", ProfilePage],
  ] as const)("renders %s", (path, Component) => {
    render(
      <VocabularyProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path={path.includes("/sets/") ? "/words/sets/:id" : path}
              element={<Component />}
            />
          </Routes>
        </MemoryRouter>
      </VocabularyProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});

it("checks context choices, preserves their order and restores a retry after reload", async () => {
  const user = userEvent.setup();
  setup(5);
  const view = mount();
  const submit = screen.getByRole("button", {
    name: "Проверить ответ",
  }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText("Выберите пропущенное слово")).toBeTruthy();
  const options = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>(".answer-choice"));
  const before = options().map((option) => option.textContent);
  expect(before).toHaveLength(4);
  expect(
    new Set(before.map((text) => text!.replace(/^\d+/, "").trim())),
  ).toEqual(
    new Set([word.contextAnswer ?? word.word, ...word.contextDistractors]),
  );
  const wrong = options().find(
    (option) => !/^\d+coffee$/.test(option.textContent ?? ""),
  )!;
  await user.click(wrong);
  expect(options().map((option) => option.textContent)).toEqual(before);
  expect(submit.disabled).toBe(false);
  await user.click(submit);
  expect(screen.getByText("Правильный ответ:")).toBeTruthy();
  expect(storageService.load().progress[word.vocabularyId].status).toBe(
    "learning",
  );
  expect(storageService.load().answers.at(-1)?.correct).toBe(false);
  view.unmount();
  mount();
  expect(screen.queryByRole("textbox")).toBeNull();
  await user.click(screen.getByRole("button", { name: /^\d+\s*coffee$/ }));
  await user.click(screen.getByRole("button", { name: "Проверить ответ" }));
  expect(storageService.load().progress[word.vocabularyId].status).toBe(
    "learned",
  );
  const answers = storageService.load().answers.slice(-2);
  expect(answers.map((answer) => answer.correct)).toEqual([false, true]);
  expect(answers[0].id).not.toBe(answers[1].id);
});

it("accepts a spelling alternative without updating the synonym word's progress", async () => {
  const target = allWords.find(
    (word) => word.vocabularyId === "colour-noun-1",
  )!;
  let data = startLesson(emptyData(), [target]);
  for (let index = 0; index < 4; index++) data = answer(data);
  storageService.save(data);
  mount();
  await userEvent
    .setup()
    .type(screen.getByLabelText("Ваш ответ на английском"), " COLOR {Enter}");
  expect(storageService.load().answers.at(-1)?.correct).toBe(true);
  expect(storageService.load().activeSession?.index).toBe(5);
  expect(screen.getByText("Выберите пропущенное слово")).toBeTruthy();
});
it("searches alternative translations and accepted English spellings in the dictionary", async () => {
  const target = allWords.find(
    (word) => word.vocabularyId === "neighbour-noun-1",
  )!;
  const friend = allWords.find(
    (word) => word.vocabularyId === "friend-noun-1",
  )!;
  storageService.save(addWords(emptyData(), [target, friend]));
  mount("/dictionary");
  const user = userEvent.setup();
  const search = screen.getByRole("textbox", { name: "Поиск по словарю" });
  await user.type(search, "neighbor");
  expect(
    screen.getByRole("checkbox", { name: "Выбрать neighbour" }),
  ).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: "Выбрать friend" })).toBeNull();
  await user.clear(search);
  await user.type(search, "приятель");
  expect(screen.getByRole("checkbox", { name: "Выбрать friend" })).toBeTruthy();
  expect(
    screen.queryByRole("checkbox", { name: "Выбрать neighbour" }),
  ).toBeNull();
});
