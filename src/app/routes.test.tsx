// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addWords,
  allWords,
  changeWordStatus,
  completeExercise,
  emptyData,
  endLesson,
  startLesson,
  storageService,
  type UserData,
  wordSets,
} from "../entities/vocabulary";
import { installDialogMock } from "../test/dialog";
import { appRoutes } from "./routes";
import { VocabularyProvider } from "./VocabularyProvider";

const word = allWords.find((w) => w.word === "coffee")!;
const routers: ReturnType<typeof createMemoryRouter>[] = [];
function seed(index = 0) {
  let d = startLesson(
    emptyData(),
    [word],
    "dictionary",
    new Date(),
    undefined,
    "route",
  );
  for (let i = 0; i < index; i++) d = answer(d);
  storageService.save(d);
  return d;
}
function answer(d: UserData) {
  const s = d.activeSession!,
    a = s.queue[s.index];
  return completeExercise(d, {
    id: a.id,
    taskId: a.taskId,
    sessionId: s.id,
    correct: true,
  });
}
function mount(initialEntries = ["/words/learn"]) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries,
    initialIndex: initialEntries.length - 1,
  });
  routers.push(router);
  const view = render(
    <VocabularyProvider>
      <RouterProvider router={router} />
    </VocabularyProvider>,
  );
  return { router, ...view };
}
let restoreDialog: () => void;
beforeEach(() => {
  window.localStorage.clear();
  restoreDialog = installDialogMock();
});
afterEach(() => {
  cleanup();
  restoreDialog();
  for (const r of routers) r.dispose();
  routers.length = 0;
  vi.restoreAllMocks();
});
describe("immersive lesson routes", () => {
  it("renders only the lesson, progress and finish action without app navigation or footer", () => {
    seed();
    mount();
    expect(screen.getByRole("heading", { name: "coffee" })).toBeTruthy();
    expect(document.querySelector(".lesson-shell")).not.toBeNull();
    expect(screen.getByRole("main").className).toBe("lesson-main");
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(document.querySelector(".sidebar")).toBeNull();
    expect(document.querySelector(".topbar")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Завершить урок" })).toBeTruthy();
    expect(screen.queryByText(/Пауза/)).toBeNull();
  });
  it.each([
    "/",
    "/dictionary",
    "/words",
    "/words/sets/everyday",
    "/settings",
    "/progress",
    "/profile",
    "/profile/settings",
    "/unknown",
  ])("returns to the active lesson from %s", async (path) => {
    seed(2);
    const { router } = mount([path]);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/words/learn"),
    );
    expect(screen.getByText("Выберите английское слово")).toBeTruthy();
    expect(storageService.load().activeSession!.index).toBe(2);
  });
  it("returns to the trainer after browser back, then allows navigation after finishing early", async () => {
    const user = userEvent.setup();
    seed(2);
    const { router } = mount(["/dictionary", "/words/learn"]);
    await act(() => router.navigate(-1));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/words/learn"),
    );
    expect(screen.getByText("Выберите английское слово")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Завершить урок" }));
    expect(
      screen.getByRole("heading", { name: "Урок завершён досрочно" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Завершить" }));
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByRole("navigation")).toBeTruthy();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });
  it("restores an unfinished lesson after reopening the app on the dashboard", async () => {
    seed(4);
    const view = mount();
    expect(screen.getByLabelText("Ваш ответ на английском")).toBeTruthy();
    view.unmount();
    const restored = mount(["/"]);
    await waitFor(() =>
      expect(restored.router.state.location.pathname).toBe("/words/learn"),
    );
    expect(screen.getByText("Напишите слово по-английски")).toBeTruthy();
    expect(storageService.load().answers).toHaveLength(4);
  });
  it("leaves navigation open after a fully completed lesson and starts a fresh replay", async () => {
    const user = userEvent.setup();
    seed(5);
    mount();
    await user.click(screen.getByRole("button", { name: /^\d+\s*coffee$/ }));
    await user.click(screen.getByRole("button", { name: "Проверить ответ" }));
    expect(
      screen.getByRole("heading", { name: "Урок завершён!" }),
    ).toBeTruthy();
    expect(storageService.load().activeSession!.status).toBe("completed");
    await user.click(screen.getByRole("link", { name: "Повторить" }));
    expect(screen.getByRole("heading", { name: "coffee" })).toBeTruthy();
    expect(storageService.load().activeSession!.index).toBe(0);
  });
  it("ends immediately via the logo and preserves the recorded error", async () => {
    const user = userEvent.setup();
    seed(4);
    mount();
    await user.type(
      screen.getByLabelText("Ваш ответ на английском"),
      "wrong{Enter}",
    );
    const before = storageService.load();
    await user.click(
      screen.getByRole("button", { name: "Wzhuh — завершить урок" }),
    );
    expect(
      screen.getByRole("heading", { name: "Урок завершён досрочно" }),
    ).toBeTruthy();
    expect(screen.queryByText("Завершить урок досрочно?")).toBeNull();
    expect(storageService.load().answers).toEqual(before.answers);
    expect(storageService.load().sessions.at(-1)?.incorrect).toBe(1);
  });
  it("stays in the lesson and displays a save error when early completion cannot be persisted", async () => {
    const user = userEvent.setup();
    seed(2);
    mount();
    const before = storageService.load();
    vi.spyOn(storageService, "save").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    await user.click(screen.getByRole("button", { name: "Завершить урок" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Не удалось сохранить",
    );
    expect(
      screen.queryByRole("heading", { name: "Урок завершён досрочно" }),
    ).toBeNull();
    expect(storageService.load()).toEqual(before);
    expect(screen.getByRole("button", { name: "Завершить урок" })).toBeTruthy();
  });
  it("keeps early results on refresh and excludes them from the completed lesson count", () => {
    storageService.save(endLesson(seed(2)));
    const view = mount();
    expect(
      screen.getByRole("heading", { name: "Урок завершён досрочно" }),
    ).toBeTruthy();
    view.unmount();
    mount(["/profile"]);
    expect(
      storageService
        .load()
        .sessions.filter((session) => session.outcome === "completed"),
    ).toHaveLength(0);
    expect(screen.queryByText("Словарь растёт вместе с вами")).toBeNull();
    expect(
      screen.queryByText("Знакомство со словом не входит в оценку точности."),
    ).toBeNull();
    expect(screen.getByText(/Завершён досрочно/)).toBeTruthy();
  });
  it.each(["/", "/dictionary", "/profile/settings"])(
    "removes footer captions on %s",
    (path) => {
      mount([path]);
      expect(screen.queryByRole("contentinfo")).toBeNull();
      expect(screen.queryByText("Wzhuh · Учиться — это привычка")).toBeNull();
      expect(
        screen.queryByText("Сделано для вашего следующего шага"),
      ).toBeNull();
    },
  );
  it("retains storage and migration notices in the fullscreen shell", () => {
    const data = seed();
    data.migrationNotice = true;
    storageService.save(data);
    mount();
    expect(screen.getByText(/Теперь все стадии/)).toBeTruthy();
    expect(
      document.querySelector(".lesson-shell .migration-notice"),
    ).not.toBeNull();
  });
});

describe("header and profile navigation", () => {
  it("shows only dictionary and profile in the header, with a home logo and no sidebar", async () => {
    const user = userEvent.setup();
    const { router } = mount(["/"]);
    const nav = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Мой словарь", "Профиль"]);
    expect(document.querySelector(".sidebar")).toBeNull();
    expect(screen.getByRole("banner").className).toBe("site-header");
    await user.click(within(nav).getByRole("link", { name: "Мой словарь" }));
    expect(router.state.location.pathname).toBe("/dictionary");
    expect(
      within(nav)
        .getByRole("link", { name: "Мой словарь" })
        .getAttribute("aria-current"),
    ).toBe("page");
    await user.click(screen.getByRole("link", { name: "Добавить слова" }));
    expect(router.state.location.pathname).toBe("/words");
    expect(
      within(nav)
        .getByRole("link", { name: "Мой словарь" })
        .getAttribute("aria-current"),
    ).toBeNull();
    await user.click(
      screen.getByRole("link", { name: /Повседневный английский/ }),
    );
    expect(router.state.location.pathname).toBe("/words");
    expect(router.state.location.search).toBe("?set=everyday-300");
    expect(
      screen.getByRole("dialog", { name: "Повседневный английский" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Закрыть набор" }));
    expect(
      within(nav)
        .getByRole("link", { name: "Мой словарь" })
        .getAttribute("aria-current"),
    ).toBeNull();
    await user.click(within(nav).getByRole("link", { name: "Профиль" }));
    expect(router.state.location.pathname).toBe("/profile");
    expect(
      within(nav)
        .getByRole("link", { name: "Профиль" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(nav)
        .getByRole("link", { name: "Мой словарь" })
        .hasAttribute("aria-current"),
    ).toBe(false);
    await user.click(screen.getByRole("link", { name: "Wzhuh — на главную" }));
    expect(router.state.location.pathname).toBe("/");
  });
  it("defaults to progress and keeps one heading while switching profile tabs and going back", async () => {
    const user = userEvent.setup();
    const { router } = mount(["/profile"]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Профиль" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Практика за неделю" }),
    ).toBeTruthy();
    const tabs = screen.getByRole("navigation", { name: "Разделы профиля" });
    expect(
      within(tabs)
        .getByRole("link", { name: "Прогресс" })
        .getAttribute("aria-current"),
    ).toBe("page");
    await user.click(within(tabs).getByRole("link", { name: "Настройки" }));
    expect(router.state.location.pathname).toBe("/profile/settings");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "Сколько слов хотите учить в день" }),
    ).toBeTruthy();
    expect(
      within(tabs)
        .getByRole("link", { name: "Настройки" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(screen.getByRole("navigation", { name: "Основная навигация" }))
        .getByRole("link", { name: "Профиль" })
        .getAttribute("aria-current"),
    ).toBe("page");
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe("/profile");
    expect(
      screen.getByRole("heading", { name: "Практика за неделю" }),
    ).toBeTruthy();
  });
  it.each([
    ["/progress", "/profile"],
    ["/settings", "/profile/settings"],
  ])("redirects %s with history replacement", async (oldPath, target) => {
    const { router } = mount(["/dictionary", oldPath]);
    await waitFor(() => expect(router.state.location.pathname).toBe(target));
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.getByRole("heading", { name: "Профиль" })).toBeTruthy();
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe("/dictionary");
  });
  it("opens settings directly, persists changes on reload and retains reset confirmation", async () => {
    const user = userEvent.setup();
    const data = emptyData();
    data.progress[word.vocabularyId] = {
      vocabularyId: word.vocabularyId,
      status: "learning",
      addedAt: new Date().toISOString(),
      learnedAt: null,
      nextReviewAt: null,
      lastReviewedAt: null,
      correctAnswers: 3,
      incorrectAnswers: 1,
      retentionIntervalIndex: 0,
    };
    storageService.save(data);
    const view = mount(["/profile/settings"]);
    await user.click(screen.getByRole("button", { name: "5 слов за раз" }));
    expect(screen.getByRole("status").textContent).toBe("Настройки сохранены");
    await user.click(screen.getByRole("switch"));
    await user.selectOptions(
      screen.getByLabelText("Вариант произношения"),
      "en-GB",
    );
    expect(storageService.load().settings).toEqual({
      quickAddCount: 5,
      speechEnabled: false,
      accent: "en-GB",
    });
    view.unmount();
    mount(["/profile/settings"]);
    expect(
      screen
        .getByRole("button", { name: "5 слов за раз" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(
      (screen.getByLabelText("Вариант произношения") as HTMLSelectElement)
        .value,
    ).toBe("en-GB");
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    expect(storageService.load().progress[word.vocabularyId]).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(storageService.load().progress[word.vocabularyId]).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await user.click(
      screen.getByRole("button", { name: "Да, удалить данные" }),
    );
    expect(storageService.load()).toEqual(emptyData());
    expect(screen.getByRole("heading", { name: "Профиль" })).toBeTruthy();
  });
});

describe("dashboard lesson selection", () => {
  function seedPool(count = 12, amount = 5) {
    const data = addWords(emptyData(), allWords.slice(0, count));
    data.settings.quickAddCount = amount;
    storageService.save(data);
    return data;
  }
  function selectedWords() {
    return within(screen.getByRole("list", { name: "Слова для урока" }))
      .getAllByRole("listitem")
      .filter((li) =>
        within(li).queryByRole("button", { name: /^Убрать .+ из урока$/ }),
      )
      .map((li) => li.querySelector("span")!.textContent!);
  }
  it("starts empty, selects a portion without starting or saving, and replaces the random action with learn", async () => {
    const user = userEvent.setup();
    const data = seedPool();
    const { router } = mount(["/"]);
    expect(
      screen.getByRole("heading", { name: "Выбрано слов: 0" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Учить" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    expect(
      screen.getByRole("heading", { name: "Выбрано слов: 5" }),
    ).toBeTruthy();
    expect(new Set(selectedWords()).size).toBe(5);
    expect(
      screen.queryByRole("button", { name: "Случайные слова" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Учить" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Выбрать вручную" })).toBeNull();
    expect(router.state.location.pathname).toBe("/");
    expect(storageService.load()).toEqual(data);
  });
  it("removes individual tags and restores random selection after the last word is removed", async () => {
    const user = userEvent.setup();
    const data = seedPool(3, 10);
    mount(["/"]);
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    expect(selectedWords()).toHaveLength(3);
    const first = selectedWords()[0];
    await user.click(
      screen.getByRole("button", { name: `Убрать ${first} из урока` }),
    );
    expect(
      screen.getByRole("heading", { name: "Выбрано слов: 2" }),
    ).toBeTruthy();
    expect(selectedWords()).not.toContain(first);
    for (const button of screen.getAllByRole("button", {
      name: /^Убрать .+ из урока$/,
    }))
      await user.click(button);
    expect(
      screen.getByRole("heading", { name: "Выбрано слов: 0" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Случайные слова" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Учить" })).toBeNull();
    expect(storageService.load()).toEqual(data);
  });
  it("starts a full lesson with exactly the displayed words after removal", async () => {
    const user = userEvent.setup();
    seedPool();
    const { router } = mount(["/"]);
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    await user.click(
      screen.getByRole("button", {
        name: `Убрать ${selectedWords()[0]} из урока`,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Добавить" }));
    const expected = selectedWords().map(
      (text) => allWords.find((w) => w.word === text)!.vocabularyId,
    );
    await user.click(screen.getByRole("button", { name: "Учить" }));
    expect(router.state.location.pathname).toBe("/words/learn");
    expect(storageService.load().activeSession!.wordIds).toEqual(expected);
    expect(storageService.load().activeSession!.tasks).toHaveLength(
      expected.length * 6,
    );
    expect(storageService.load().answers).toEqual([]);
  });
  it("resets the draft after navigating through the header or reloading", async () => {
    const user = userEvent.setup();
    const data = seedPool();
    const view = mount(["/"]);
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    await user.click(screen.getByRole("link", { name: "Мой словарь" }));
    expect(view.router.state.location.pathname).toBe("/dictionary");
    expect(
      screen.queryByRole("button", { name: "Учить выбранные" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Выбранные слова" }),
    ).toBeNull();
    await user.click(screen.getByRole("link", { name: "Wzhuh — на главную" }));
    expect(
      screen.getByRole("heading", { name: "Выбрано слов: 0" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    view.unmount();
    mount(["/"]);
    expect(
      screen.getByRole("heading", { name: "Выбрано слов: 0" }),
    ).toBeTruthy();
    expect(storageService.load()).toEqual(data);
  });
  it.each([false, true])(
    "shows only an invitation when no learning words exist (learned=%s)",
    (learned) => {
      if (learned) {
        const data = seedPool(2);
        for (const p of Object.values(data.progress)) {
          p.status = "learned";
          p.learnedAt = new Date().toISOString();
        }
        storageService.save(data);
      }
      mount(["/"]);
      expect(
        screen.getByRole("heading", {
          name: "Чтобы начать учить слова, добавьте их в свой словарь из наборов ниже",
        }),
      ).toBeTruthy();
      expect(screen.queryByText("Выбрано слов: 0")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Случайные слова" }),
      ).toBeNull();
      expect(
        screen.queryByRole("link", { name: "Выбрать вручную" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Учить" })).toBeNull();
    },
  );
  it("never includes learned words even when their review is overdue", async () => {
    const user = userEvent.setup();
    const data = seedPool(4, 10);
    const learned = allWords[0];
    data.progress[learned.vocabularyId] = {
      ...data.progress[learned.vocabularyId],
      status: "learned",
      learnedAt: new Date().toISOString(),
      nextReviewAt: "2020-01-01T00:00:00Z",
    };
    storageService.save(data);
    mount(["/"]);
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    expect(selectedWords()).toHaveLength(3);
    expect(selectedWords()).not.toContain(learned.word);
    expect(storageService.load()).toEqual(data);
  });
  it("keeps the draft when the lesson cannot be saved", async () => {
    const user = userEvent.setup();
    const data = seedPool();
    const { router } = mount(["/"]);
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    const selected = selectedWords();
    vi.spyOn(storageService, "save").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    await user.click(screen.getByRole("button", { name: "Учить" }));
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByRole("alert").textContent).toContain(
      "Не удалось сохранить",
    );
    expect(selectedWords()).toEqual(selected);
    expect(storageService.load()).toEqual(data);
  });
});

describe("incremental random lesson selection", () => {
  it("adds exactly one unselected learning word per click beyond the initial portion, without saving", async () => {
    const user = userEvent.setup();
    const data = addWords(emptyData(), allWords.slice(0, 9));
    data.settings.quickAddCount = 5;
    data.progress[allWords[0].vocabularyId] = {
      ...data.progress[allWords[0].vocabularyId],
      status: "learned",
      learnedAt: new Date().toISOString(),
    };
    storageService.save(data);
    mount(["/"]);
    expect(screen.queryByRole("button", { name: "Добавить" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Выбрать вручную" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    const names = () =>
      screen
        .getAllByRole("button", { name: /^Убрать .+ из урока$/ })
        .map((b) => b.getAttribute("aria-label")!);
    expect(names()).toHaveLength(5);
    for (let count = 6; count <= 8; count++) {
      const before = names();
      await user.click(screen.getByRole("button", { name: "Добавить" }));
      expect(names()).toHaveLength(count);
      expect(new Set(names()).size).toBe(count);
      expect(before.every((name) => names().includes(name))).toBe(true);
      expect(
        screen.getByRole("heading", { name: `Выбрано слов: ${count}` }),
      ).toBeTruthy();
      if (count < 8)
        expect(
          screen.getByRole("list", { name: "Слова для урока" })
            .lastElementChild!.textContent,
        ).toBe("Добавить");
    }
    expect(names()).not.toContain(`Убрать ${allWords[0].word} из урока`);
    expect(screen.queryByRole("button", { name: "Добавить" })).toBeNull();
    expect(storageService.load()).toEqual(data);
    const removedName = names()[0];
    await user.click(screen.getByRole("button", { name: removedName }));
    expect(
      (screen.getByRole("button", { name: "Добавить" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await user.click(screen.getByRole("button", { name: "Добавить" }));
    expect(names()).toHaveLength(8);
    expect(names()).toContain(removedName);
    expect(storageService.load()).toEqual(data);
  });
});
describe("set word modals", () => {
  it.each(["/", "/words"])(
    "opens above %s without changing the page and adds one word immediately",
    async (path) => {
      const user = userEvent.setup();
      const { router } = mount([path]);
      const card = screen.getByRole("link", {
        name: /Повседневный английский/,
      });
      const before = storageService.load();
      await user.click(card);
      const dialog = screen.getByRole("dialog", {
        name: "Повседневный английский",
      });
      expect(router.state.location.pathname).toBe(path);
      expect(router.state.location.search).toBe("?set=everyday-300");
      expect(dialog.hasAttribute("open")).toBe(true);
      expect(document.activeElement).toBe(
        within(dialog).getByRole("button", { name: "Закрыть набор" }),
      );
      expect(document.body.style.overflow).toBe("hidden");
      expect(storageService.load()).toEqual(before);
      const row = within(dialog).getByText("hello").closest("li")!;
      expect(within(row).getByText("привет")).toBeTruthy();
      await user.click(
        within(row).getByRole("button", { name: "Добавить hello" }),
      );
      expect(
        within(row).queryByRole("button", { name: "Добавить hello" }),
      ).toBeNull();
      expect(within(row).getByText("Добавлено")).toBeTruthy();
      const saved = storageService.load();
      expect(saved.progress["hello-interjection-1"].status).toBe("learning");
      expect(saved.activeSession).toBeNull();
      expect(saved.answers).toEqual([]);
      expect(screen.getByRole("dialog")).toBe(dialog);
      await user.click(
        within(dialog).getByRole("button", { name: "Закрыть набор" }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(router.state.location.search).toBe("");
      expect(document.body.style.overflow).toBe("");
      expect(document.activeElement).toBe(card);
      expect(storageService.load()).toEqual(saved);
    },
  );
  it("adds a whole set without a quick-count cap and lists it under my sets", async () => {
    const user = userEvent.setup();
    const data = emptyData();
    data.settings.quickAddCount = 5;
    data.selectedSets = [];
    storageService.save(data);
    mount(["/words"]);
    await user.click(screen.getByRole("link", { name: /Работа и карьера/ }));
    const dialog = screen.getByRole("dialog", { name: "Работа и карьера" });
    expect(storageService.load().selectedSets).toEqual([]);
    await user.click(
      within(dialog).getByRole("button", { name: "Добавить весь набор" }),
    );
    const saved = storageService.load();
    expect(Object.keys(saved.progress)).toHaveLength(300);
    expect(saved.selectedSets).toEqual(["work-300"]);
    expect(saved.settings.quickAddCount).toBe(5);
    expect(saved.activeSession).toBeNull();
    expect(saved.answers).toEqual([]);
    expect(within(dialog).getAllByText("Добавлено")).toHaveLength(300);
    expect(within(dialog).getByText("Весь набор добавлен")).toBeTruthy();
    expect(
      within(dialog).queryByRole("button", { name: "Добавить весь набор" }),
    ).toBeNull();
    await user.click(
      within(dialog).getByRole("button", { name: "Закрыть набор" }),
    );
    await user.click(screen.getByRole("button", { name: /Мои наборы/ }));
    expect(screen.getByRole("link", { name: /Работа и карьера/ })).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Повседневный английский/ }),
    ).toBeNull();
    await user.click(screen.getByRole("link", { name: /Работа и карьера/ }));
    expect(
      within(screen.getByRole("dialog")).getByText("Весь набор добавлен"),
    ).toBeTruthy();
    expect(storageService.load()).toEqual(saved);
  });
  it("preserves learned/shared vocabulary and shows learned and added states", async () => {
    const user = userEvent.setup();
    const water = allWords.find((w) => w.word === "water")!;
    const data = addWords(emptyData(), [water]);
    data.progress[water.vocabularyId] = {
      ...data.progress[water.vocabularyId],
      status: "learned",
      learnedAt: new Date().toISOString(),
      correctAnswers: 8,
      incorrectAnswers: 2,
      nextReviewAt: "2099-01-01T00:00:00Z",
    };
    storageService.save(data);
    mount(["/words?set=food-200"]);
    const dialog = screen.getByRole("dialog", { name: "Еда и рестораны" });
    const row = within(dialog).getByText("water").closest("li")!;
    expect(within(row).getByText("Изучено")).toBeTruthy();
    expect(within(row).getByText("Добавлено")).toBeTruthy();
    expect(within(row).queryByRole("button")).toBeNull();
    expect(within(dialog).getByText("1/200")).toBeTruthy();
    expect(
      within(dialog).getByRole("progressbar").getAttribute("aria-valuenow"),
    ).toBe("1");
    await user.click(
      within(dialog).getByRole("button", { name: "Добавить весь набор" }),
    );
    expect(storageService.load().progress[water.vocabularyId]).toEqual(
      data.progress[water.vocabularyId],
    );
    expect(Object.keys(storageService.load().progress)).toHaveLength(200);
  });
  it("shows save failures inside the dialog without marking a word as added", async () => {
    const user = userEvent.setup();
    mount(["/words?set=work-300"]);
    const before = storageService.load();
    const dialog = screen.getByRole("dialog");
    vi.spyOn(storageService, "save").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Добавить achieve" }),
    );
    expect(within(dialog).getByRole("alert").textContent).toContain(
      "Не удалось сохранить",
    );
    expect(
      within(dialog).getByRole("button", { name: "Добавить achieve" }),
    ).toBeTruthy();
    expect(
      within(within(dialog).getByText("achieve").closest("li")!).queryByText(
        "Добавлено",
      ),
    ).toBeNull();
    expect(storageService.load()).toEqual(before);
  });
  it("supports Tab wrapping, Escape, backdrop and native cancel events", async () => {
    const user = userEvent.setup();
    const { router } = mount(["/words"]);
    const card = screen.getByRole("link", { name: /Повседневный английский/ });
    await user.click(card);
    let dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Закрыть набор" });
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Добавить весь набор" }),
    );
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(card);
    await user.click(card);
    dialog = screen.getByRole("dialog");
    await user.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(card);
    dialog = screen.getByRole("dialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.state.location.pathname).toBe("/words");
  });
  it("preserves catalog filters, search and other query parameters while closing with browser back", async () => {
    const user = userEvent.setup();
    const { router } = mount(["/words?view=all"]);
    await user.click(screen.getByRole("button", { name: /Мои наборы/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Поиск наборов" }),
      "Повседневный",
    );
    const card = screen.getByRole("link", { name: /Повседневный английский/ });
    await user.click(card);
    expect(router.state.location.search).toBe("?view=all&set=everyday-300");
    await act(() => router.navigate(-1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.state.location.search).toBe("?view=all");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Поиск наборов",
        }) as HTMLInputElement
      ).value,
    ).toBe("Повседневный");
    expect(screen.queryByRole("link", { name: /Работа и карьера/ })).toBeNull();
    expect(document.activeElement).toBe(card);
    await act(() => router.navigate(1));
    expect(
      screen.getByRole("dialog", { name: "Повседневный английский" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Закрыть набор" }));
    expect(router.state.location.search).toBe("?view=all");
  });
  it("does not change the lesson draft when adding from a set on the dashboard", async () => {
    const user = userEvent.setup();
    storageService.save(addWords(emptyData(), allWords.slice(0, 5)));
    mount(["/"]);
    await user.click(screen.getByRole("button", { name: "Случайные слова" }));
    const names = () =>
      screen
        .getAllByRole("button", { name: /^Убрать .+ из урока$/ })
        .map((b) => b.getAttribute("aria-label"));
    const before = names();
    await user.click(screen.getByRole("link", { name: /Еда и рестораны/ }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Добавить весь набор",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Закрыть набор" }));
    expect(names()).toEqual(before);
    expect(storageService.load().activeSession).toBeNull();
    expect(storageService.load().answers).toEqual([]);
  });
  it.each([
    ["everyday-300", "Повседневный английский"],
    ["missing", "Набор не найден"],
  ])("redirects old set URL %s into a modal", async (id, title) => {
    const user = userEvent.setup();
    const { router } = mount([`/words/sets/${id}`]);
    await waitFor(() => expect(router.state.location.pathname).toBe("/words"));
    expect(router.state.location.search).toBe(`?set=${id}`);
    expect(screen.getByRole("dialog", { name: title })).toBeTruthy();
    expect(router.state.historyAction).toBe("REPLACE");
    await user.click(screen.getByRole("button", { name: "Закрыть набор" }));
    expect(router.state.location.search).toBe("");
  });
});

describe("dictionary status editing", () => {
  it("persists both statuses, keeps the first date and updates filtered rows", async () => {
    const data = addWords(emptyData(), [word]);
    data.progress[word.vocabularyId].nextReviewAt = "2030-01-01T00:00:00.000Z";
    storageService.save(data);
    const user = userEvent.setup();
    const view = mount(["/dictionary"]);
    expect(screen.getByText("СТАТУС")).toBeTruthy();
    expect(screen.queryByText(/Повторение:|Рекомендуем повторить/)).toBeNull();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Статус слова coffee" }),
      "learned",
    );
    const learned = storageService.load();
    expect(learned.progress[word.vocabularyId].learnedAt).toBeTruthy();
    expect(learned.answers).toEqual(data.answers);
    expect(learned.sessions).toEqual(data.sessions);
    expect(learned.progress[word.vocabularyId].nextReviewAt).toBe(
      data.progress[word.vocabularyId].nextReviewAt,
    );
    view.unmount();
    mount(["/dictionary"]);
    expect(
      (
        screen.getByRole("combobox", {
          name: "Статус слова coffee",
        }) as HTMLSelectElement
      ).value,
    ).toBe("learned");
    await user.click(screen.getByRole("button", { name: /^Изучены/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Статус слова coffee" }),
      "learning",
    );
    expect(
      screen.queryByRole("combobox", { name: "Статус слова coffee" }),
    ).toBeNull();
    expect(storageService.load().progress[word.vocabularyId]).toEqual({
      ...learned.progress[word.vocabularyId],
      status: "learning",
    });
    await user.click(screen.getByRole("button", { name: /^На изучении/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Статус слова coffee" }),
      "learned",
    );
    expect(storageService.load().progress[word.vocabularyId].learnedAt).toBe(
      learned.progress[word.vocabularyId].learnedAt,
    );
  });
  it("retains the current status when saving fails", async () => {
    const data = addWords(emptyData(), [word]);
    storageService.save(data);
    mount(["/dictionary"]);
    vi.spyOn(storageService, "save").mockImplementation(() => {
      throw new Error("disk full");
    });
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole("combobox", { name: "Статус слова coffee" }),
        "learned",
      );
    expect(
      (
        screen.getByRole("combobox", {
          name: "Статус слова coffee",
        }) as HTMLSelectElement
      ).value,
    ).toBe("learning");
    expect(storageService.load()).toEqual(data);
    expect(screen.getByRole("alert")).toBeTruthy();
  });
  it("preserves the original date after returning to learning and completing a lesson", () => {
    const firstDate = new Date("2026-01-01T00:00:00Z");
    let data = changeWordStatus(
      addWords(emptyData(), [word]),
      word.vocabularyId,
      "learned",
      firstDate,
    );
    data = changeWordStatus(data, word.vocabularyId, "learning");
    data = startLesson(data, [word]);
    while (data.activeSession?.status === "active") data = answer(data);
    expect(data.progress[word.vocabularyId].learnedAt).toBe(
      firstDate.toISOString(),
    );
    expect(data.activeSession?.firstLearnedIds).toEqual([]);
  });
});

describe("dictionary set filtering", () => {
  it("combines set, status and search while keeping selections and counts", async () => {
    let data = addWords(emptyData(), allWords);
    const water = allWords.find((w) => w.word === "water")!;
    data = changeWordStatus(data, water.vocabularyId, "learned");
    storageService.save(data);
    const user = userEvent.setup();
    mount(["/dictionary"]);
    const filter = screen.getByRole("combobox", { name: "Фильтр по набору" });
    expect((filter as HTMLSelectElement).value).toBe("");
    const food = wordSets.find((set) => set.id === "food-200")!;
    await user.selectOptions(filter, "food-200");
    expect(
      screen.getAllByRole("combobox", { name: /^Статус слова/ }),
    ).toHaveLength(food.words.length);
    await user.click(screen.getByRole("button", { name: /^Изучены/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Поиск по словарю" }),
      "water",
    );
    expect(
      screen.getAllByRole("combobox", { name: /^Статус слова/ }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", {
        name: new RegExp(`^Все\\s*${food.words.length}$`),
      }),
    ).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Выбрать видимые" }));
    await user.selectOptions(filter, "everyday-300");
    expect(
      screen
        .getByRole("checkbox", { name: "Выбрать water" })
        .getAttribute("type"),
    ).toBe("checkbox");
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Выбрать water",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: /^На изучении/ }));
    expect(
      screen.getByRole("heading", { name: "Слова не найдены" }),
    ).toBeTruthy();
    expect(screen.getByText("Выбрано: 1")).toBeTruthy();
    expect(storageService.load()).toEqual(data);
    const link = screen.getByRole("link", { name: "Добавить слова" });
    expect(link.className).toBe("text-link");
    await user.click(link);
    expect(
      screen.getByRole("heading", { name: "Словарные наборы" }),
    ).toBeTruthy();
  });
});

describe("dictionary bottom selection bar", () => {
  it("shows mixed selection in the header, clears the bar and starts hidden selected words", async () => {
    const words = allWords.slice(0, 3);
    storageService.save(addWords(emptyData(), words));
    const user = userEvent.setup();
    mount(["/dictionary"]);
    expect(
      screen.queryByRole("region", { name: "Выбранные слова" }),
    ).toBeNull();
    const all = screen.getByRole("checkbox", {
      name: "Выбрать видимые",
    }) as HTMLInputElement;
    expect(all.closest(".word-table-head")).toBeTruthy();
    await user.click(
      screen.getByRole("checkbox", { name: `Выбрать ${words[0].word}` }),
    );
    expect(all.indeterminate).toBe(true);
    expect(
      screen.getByRole("region", { name: "Выбранные слова" }),
    ).toBeTruthy();
    await user.click(all);
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);
    await user.click(screen.getByRole("button", { name: "Снять выбор" }));
    expect(
      screen.queryByRole("region", { name: "Выбранные слова" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("checkbox", { name: `Выбрать ${words[0].word}` }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Поиск по словарю" }),
      "no-matching-word",
    );
    expect(
      screen.queryByRole("checkbox", { name: "Выбрать видимые" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Учить выбранные" }));
    expect(storageService.load().activeSession?.wordIds).toEqual([
      words[0].vocabularyId,
    ]);
  });
});

describe("dashboard review launch", () => {
  it("hides review without learned words and launches a full lesson before its due date", async () => {
    storageService.save(addWords(emptyData(), [word]));
    const view = mount(["/"]);
    expect(screen.queryByText("Дней практики")).toBeNull();
    expect(screen.queryByRole("button", { name: "Повторять" })).toBeNull();
    view.unmount();
    const data = changeWordStatus(
      storageService.load(),
      word.vocabularyId,
      "learned",
    );
    data.progress[word.vocabularyId].nextReviewAt = "2099-01-01T00:00:00Z";
    storageService.save(data);
    mount(["/"]);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Повторять" }));
    const session = storageService.load().activeSession!;
    expect(session.wordIds).toEqual([word.vocabularyId]);
    expect(session.index).toBe(0);
    expect(session.tasks.map((task) => task.exercise)).toContain("context");
    expect(screen.getByRole("heading", { name: word.word })).toBeTruthy();
  });
  it("stays on home with a storage error when review cannot be saved", async () => {
    const data = changeWordStatus(
      addWords(emptyData(), [word]),
      word.vocabularyId,
      "learned",
    );
    storageService.save(data);
    const { router } = mount(["/"]);
    vi.spyOn(storageService, "save").mockImplementation(() => {
      throw new Error("disk full");
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Повторять" }));
    expect(router.state.location.pathname).toBe("/");
    expect(storageService.load()).toEqual(data);
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

it("shows the first six ordered sets on home and all ordered options in the dictionary", async () => {
  const { router } = mount(["/"]);
  const cards = document.querySelectorAll(".dashboard-sets .set-card h3");
  expect(Array.from(cards, (card) => card.textContent)).toEqual(
    wordSets.slice(0, 6).map((set) => set.title),
  );
  await act(() => router.navigate("/dictionary"));
  const filter = screen.getByRole("combobox", {
    name: "Фильтр по набору",
  }) as HTMLSelectElement;
  expect(
    Array.from(filter.options)
      .slice(1)
      .map((option) => option.value),
  ).toEqual(wordSets.map((set) => set.id));
  await act(() => router.navigate("/words"));
  expect(
    Array.from(
      document.querySelectorAll(".set-grid .set-card h3"),
      (card) => card.textContent,
    ),
  ).toEqual(wordSets.map((set) => set.title));
});
