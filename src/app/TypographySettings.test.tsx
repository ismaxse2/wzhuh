// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  allWords,
  emptyData,
  migrate,
  startLesson,
  storageService,
} from "../entities/vocabulary";
import { LearningPage } from "../pages/LearningPage";
import { SettingsPage } from "../pages/SettingsPage";
import { Layout } from "./layout/Layout";
import { TypographySettings } from "./TypographySettings";
import { VocabularyProvider } from "./VocabularyProvider";

function mount(lesson = false) {
  return render(
    <VocabularyProvider>
      <TypographySettings />
      <MemoryRouter>
        {lesson ? (
          <LearningPage />
        ) : (
          <>
            <Layout />
            <SettingsPage />
          </>
        )}
      </MemoryRouter>
    </VocabularyProvider>,
  );
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty("font-size");
});

describe("application font size", () => {
  it("applies and saves every size, restores it on mount and resets it", async () => {
    const user = userEvent.setup();
    const view = mount();
    expect(screen.getByRole("group", { name: "Размер шрифта" })).toBeTruthy();
    for (const [name, size, value] of [
      ["Крупный", "18px", "large"],
      ["Очень крупный", "20px", "extra-large"],
      ["Обычный", "16px", "normal"],
      ["Крупный", "18px", "large"],
    ]) {
      await user.click(screen.getByRole("radio", { name }));
      expect(document.documentElement.style.fontSize).toBe(size);
      expect(storageService.load().settings.fontSize).toBe(value);
    }
    view.unmount();
    mount();
    expect(document.documentElement.style.fontSize).toBe("18px");
    expect(
      (screen.getByRole("radio", { name: "Крупный" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Сбросить" }));
    await user.click(
      screen.getByRole("button", { name: "Да, удалить данные" }),
    );
    expect(document.documentElement.style.fontSize).toBe("16px");
  });

  it("keeps the previous size and selection when saving fails", async () => {
    mount();
    vi.spyOn(storageService, "save").mockImplementation(() => {
      throw new Error("storage denied");
    });
    await userEvent
      .setup()
      .click(screen.getByRole("radio", { name: "Очень крупный" }));
    expect(document.documentElement.style.fontSize).toBe("16px");
    expect(
      (screen.getByRole("radio", { name: "Обычный" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getByText(/Не удалось сохранить изменения/)).toBeTruthy();
    expect(storageService.load().settings.fontSize).toBe("normal");
  });

  it("applies cross-tab changes to a restored lesson", () => {
    const data = startLesson(emptyData(), [allWords[0]]);
    data.settings.fontSize = "extra-large";
    storageService.save(data);
    mount(true);
    expect(document.documentElement.style.fontSize).toBe("20px");
    expect(document.querySelector(".exercise-card")).toBeTruthy();
    act(() => {
      storageService.save({
        ...data,
        settings: { ...data.settings, fontSize: "large" },
      });
      window.dispatchEvent(
        new StorageEvent("storage", { key: "wzhuh:user:v1" }),
      );
    });
    expect(document.documentElement.style.fontSize).toBe("18px");
    expect(storageService.load().activeSession).toEqual(data.activeSession);
  });

  it.each([undefined, null, "huge", 20])(
    "defaults unsupported saved size %s without losing progress",
    (fontSize) => {
      const data = startLesson(emptyData(), [allWords[0]]);
      const restored = migrate({
        ...data,
        settings: { ...data.settings, fontSize },
      });
      expect(restored.settings.fontSize).toBe("normal");
      expect(restored.activeSession).toEqual(data.activeSession);
      expect(restored.progress).toEqual(data.progress);
    },
  );
});
