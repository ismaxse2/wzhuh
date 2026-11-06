// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { VocabularyProvider } from "../../../app/VocabularyProvider";
import { wordSets } from "../../../entities/vocabulary";
import { installDialogMock } from "../../../test/dialog";
import { SetWordsModal } from "./SetWordsModal";
let restoreDialog: () => void;
beforeEach(() => {
  window.localStorage.clear();
  restoreDialog = installDialogMock();
});
afterEach(() => {
  cleanup();
  restoreDialog();
});
it("handles an empty set with zero progress and only the close action", async () => {
  const user = userEvent.setup(),
    close = vi.fn();
  render(
    <VocabularyProvider>
      <SetWordsModal
        set={{
          id: "empty",
          title: "Пустой набор",
          description: "",
          level: "A1",
          words: [],
        }}
        onClose={close}
      />
    </VocabularyProvider>,
  );
  expect(screen.getByRole("dialog", { name: "Пустой набор" })).toBeTruthy();
  expect(screen.getByText("В наборе пока нет слов")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "0",
  );
  expect(screen.getByText("0/0")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe(
    "Изучено 0 из 0 слов",
  );
  expect(screen.getAllByRole("button")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Закрыть набор" }));
  expect(close).toHaveBeenCalledTimes(1);
});

it("fades only while more words remain below and updates on resize", () => {
  render(
    <VocabularyProvider>
      <SetWordsModal set={wordSets[0]} onClose={() => {}} />
    </VocabularyProvider>,
  );
  const list = screen.getByRole("list", { name: "Слова набора" });
  const area = list.parentElement!;
  expect(area.classList.contains("has-more-below")).toBe(false);
  Object.defineProperties(list, {
    scrollHeight: { configurable: true, value: 600 },
    clientHeight: { configurable: true, value: 200 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  });
  fireEvent.resize(window);
  expect(area.classList.contains("has-more-below")).toBe(true);
  list.scrollTop = 400;
  fireEvent.scroll(list);
  expect(area.classList.contains("has-more-below")).toBe(false);
  list.scrollTop = 50;
  fireEvent.scroll(list);
  expect(area.classList.contains("has-more-below")).toBe(true);
  Object.defineProperty(list, "clientHeight", { value: 600 });
  fireEvent.resize(window);
  expect(area.classList.contains("has-more-below")).toBe(false);
});
