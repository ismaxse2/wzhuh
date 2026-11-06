// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VocabularyProvider } from "../../../app/VocabularyProvider";
import {
  addWords,
  allWords,
  emptyData,
  storageService,
  type WordSet,
} from "../../../entities/vocabulary";
import { SetCard } from "./SetCard";

const set: WordSet = {
  id: "test",
  title: "Test Set",
  description: "Описание набора",
  level: "A2",
  words: allWords.slice(0, 3),
};
function QueryMarker() {
  const [params] = useSearchParams();
  return params.has("set") ? <h1>Открытый набор</h1> : null;
}
function mount(currentSet = set) {
  return render(
    <VocabularyProvider>
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <SetCard set={currentSet} />
                <QueryMarker />
              </>
            }
          />
          <Route path="/words/sets/:id" element={<h1>Открытый набор</h1>} />
        </Routes>
      </MemoryRouter>
    </VocabularyProvider>,
  );
}
beforeEach(() => window.localStorage.clear());
afterEach(cleanup);
describe("compact set cards", () => {
  it.each([
    [0, 0],
    [1, 33],
    [2, 67],
    [3, 100],
  ])("shows %i fully learned words as %i percent", (learned, percent) => {
    const data = addWords(emptyData(), set.words);
    for (const word of set.words.slice(0, learned))
      data.progress[word.vocabularyId] = {
        ...data.progress[word.vocabularyId],
        status: "learned",
        learnedAt: new Date().toISOString(),
      };
    storageService.save(data);
    mount();
    const bar = screen.getByRole("progressbar", {
      name: "Прогресс набора Test Set",
    });
    expect(bar.getAttribute("aria-valuenow")).toBe(String(percent));
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(screen.getByText(`${percent}%`)).toBeTruthy();
    expect(screen.getByRole("heading", { name: set.title })).toBeTruthy();
    expect(screen.getByText(set.description)).toBeTruthy();
  });
  it("shows zero for an empty set and removes old icon, level and count elements", () => {
    mount({ ...set, words: [] });
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "0",
    );
    expect(screen.queryByText("A2")).toBeNull();
    expect(screen.queryByText("Выбран")).toBeNull();
    expect(
      document.querySelector(
        ".set-icon,.set-meta,.level-badge,.progress-track,.set-card-bottom",
      ),
    ).toBeNull();
    expect(screen.getByRole("link").textContent).toBe(
      "0%Test SetОписание набора",
    );
  });
  it("opens the set with the keyboard and leaves selected-set preferences unchanged", async () => {
    const user = userEvent.setup();
    const data = emptyData();
    data.selectedSets = ["test"];
    storageService.save(data);
    mount();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link"));
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("heading", { name: "Открытый набор" }),
    ).toBeTruthy();
    expect(storageService.load()).toEqual(data);
  });
});
