// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  contextSegments,
  tooltipPosition,
  type Word,
  wordSets,
} from "../../../entities/vocabulary";
import { ContextSentence } from "./ContextSentence";

const word: Word = {
  alternativeTranslations: [],
  acceptedAnswers: ["target"],
  contextDistractors: ["although", "unless", "because"],
  id: "test-target",
  vocabularyId: "target-noun",
  word: "target",
  translation: "цель",
  partOfSpeech: "noun",
  transcription: "",
  example: "We need a target.",
  exampleTranslation: "Нам нужна цель.",
  exampleTokens: [
    { text: "We", translation: "нам" },
    { text: " " },
    { text: "need", translation: "нужна" },
    { text: " " },
    { text: "a", translation: "неопределённый артикль" },
    { text: " " },
    { text: "target", translation: "цель" },
    { text: "." },
  ],
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("context annotations", () => {
  it("covers every word in all catalog examples without changing the source sentence", () => {
    const words = wordSets.flatMap((s) => s.words);
    expect(words).toHaveLength(2610);
    for (const w of words) {
      expect(w.exampleTokens?.map((t) => t.text).join("")).toBe(w.example);
      for (const token of w.exampleTokens!) {
        if (/[a-z]/i.test(token.text)) {
          expect(token.text).toMatch(/^[a-z]+(?:['’-][a-z]+)*$/i);
          expect(token.translation?.trim().length).toBeGreaterThan(0);
        } else expect(token.translation).toBeUndefined();
      }
      const segments = contextSegments(w)!;
      expect(segments).not.toBeNull();
      expect(
        [...segments.before, ...segments.after].every(
          (t) =>
            !t.translation ||
            !t.translation.toLowerCase().includes(w.word.toLowerCase()),
        ),
      ).toBe(true);
      expect(
        [...segments.before, ...segments.after].some(
          (t) =>
            t.text.toLowerCase() === (w.contextAnswer ?? w.word).toLowerCase(),
        ),
      ).toBe(false);
    }
  });
  it("preserves spaces, punctuation, contractions, hyphens and different translations of repeated words", () => {
    const w: Word = {
      ...word,
      example: "Let's re-read a target, then re-read.",
      exampleTokens: [
        { text: "Let's", translation: "давай" },
        { text: " " },
        { text: "re-read", translation: "перечитаем" },
        { text: " a ", translation: undefined },
        { text: "target", translation: "цель" },
        { text: ", then ", translation: undefined },
        { text: "re-read", translation: "перечитай ещё раз" },
        { text: "." },
      ],
    };
    const segments = contextSegments(w)!;
    expect(segments.before.map((t) => t.text).join("")).toBe(
      "Let's re-read a ",
    );
    expect(segments.after.map((t) => t.text).join("")).toBe(", then re-read.");
    render(<ContextSentence word={w} />);
    expect(document.querySelector(".context-sentence")!.textContent).toBe(
      "Let's re-read a ________, then re-read.",
    );
  });
  it("does not attach a whole-token translation to a fragment overlapping the blank", () => {
    const w = {
      ...word,
      word: "ice",
      example: "Try ice-cream.",
      exampleTokens: [
        { text: "Try", translation: "попробуй" },
        { text: " " },
        { text: "ice-cream", translation: "мороженое" },
        { text: "." },
      ],
    };
    expect(contextSegments(w)?.after).toEqual([
      { text: "-cream" },
      { text: "." },
    ]);
  });
});
describe("word tooltips", () => {
  it("opens, replaces and toggles one tooltip without exposing the missing word", async () => {
    const user = userEvent.setup();
    render(<ContextSentence word={word} />);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Перевод слова target" }),
    ).toBeNull();
    const we = screen.getByRole("button", { name: "Перевод слова We" });
    await user.click(we);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toBe("нам");
    expect(we.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(we.getAttribute("aria-expanded")).toBe("true");
    await user.click(
      screen.getByRole("button", { name: "Перевод слова need" }),
    );
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip").textContent).toBe("нужна");
    expect(we.hasAttribute("aria-describedby")).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Перевод слова need" }),
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(document.querySelector(".context-sentence")!.textContent).toBe(
      "We need a ________.",
    );
  });
  it("supports Enter, Space, Escape and moving focus with Tab", async () => {
    const user = userEvent.setup();
    render(<ContextSentence word={word} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tooltip").textContent).toBe("нам");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.keyboard(" ");
    expect(screen.getByRole("tooltip").textContent).toBe("нам");
    await user.tab();
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.keyboard(" ");
    expect(screen.getByRole("tooltip").textContent).toBe("нужна");
  });
  it("opens by touch and closes on an outside pointer event", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ContextSentence word={word} />
        <input aria-label="Ответ" />
      </>,
    );
    await user.pointer([
      {
        keys: "[TouchA>]",
        target: screen.getByRole("button", { name: "Перевод слова a" }),
      },
      { keys: "[/TouchA]" },
    ]);
    expect(screen.getByRole("tooltip").textContent).toBe(
      "неопределённый артикль",
    );
    await user.click(screen.getByRole("textbox", { name: "Ответ" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it.each(["scroll", "resize"])("closes on %s", async (event) => {
    const user = userEvent.setup();
    render(<ContextSentence word={word} />);
    await user.click(screen.getByRole("button", { name: "Перевод слова We" }));
    fireEvent(window, new Event(event));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("closes on nested scrolling, reveals only plain answer text after an error and cleans up on unmount", async () => {
    const user = userEvent.setup();
    const view = render(
      <div data-testid="scroll-area">
        <ContextSentence word={word} />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Перевод слова We" }));
    fireEvent.scroll(screen.getByTestId("scroll-area"));
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Перевод слова We" }));
    view.rerender(<ContextSentence word={word} revealed />);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByText("target").tagName).toBe("SPAN");
    expect(
      screen.queryByRole("button", { name: "Перевод слова target" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Перевод слова We" }));
    view.unmount();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("uses occurrence-specific translations for repeated words", async () => {
    const w = {
      ...word,
      example: "Read a target and read.",
      exampleTokens: [
        { text: "Read", translation: "прочти" },
        { text: " a " },
        { text: "target", translation: "цель" },
        { text: " and " },
        { text: "read", translation: "читай" },
        { text: "." },
      ],
    };
    const user = userEvent.setup();
    render(<ContextSentence word={w} />);
    await user.click(
      screen.getByRole("button", { name: "Перевод слова Read" }),
    );
    expect(screen.getByRole("tooltip").textContent).toBe("прочти");
    await user.click(
      screen.getByRole("button", { name: "Перевод слова read" }),
    );
    expect(screen.getByRole("tooltip").textContent).toBe("читай");
  });
  it.each([
    undefined,
    [{ text: "Outdated sentence", translation: "устаревшие данные" }],
  ])(
    "falls back to plain text for missing or mismatched annotation",
    (tokens) => {
      render(<ContextSentence word={{ ...word, exampleTokens: tokens }} />);
      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryByRole("tooltip")).toBeNull();
      expect(document.querySelector(".context-sentence")!.textContent).toBe(
        "We need a ________.",
      );
    },
  );
  it("preserves the existing fallback when there is no answer in the example", () => {
    render(
      <ContextSentence word={{ ...word, example: "Something different." }} />,
    );
    expect(screen.getByText("Введите слово: «цель»")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
describe("tooltip layout", () => {
  it("centres above a word when there is room", () =>
    expect(
      tooltipPosition(
        { left: 200, top: 100, bottom: 125, width: 50 },
        { width: 120, height: 40 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 165, top: 52 }));
  it("flips below near the top and clamps to the left screen edge", () =>
    expect(
      tooltipPosition(
        { left: 0, top: 20, bottom: 40, width: 30 },
        { width: 200, height: 60 },
        { width: 320, height: 600 },
      ),
    ).toEqual({ left: 8, top: 48 }));
  it("clamps to the right and bottom edges of a narrow viewport", () =>
    expect(
      tooltipPosition(
        { left: 300, top: 20, bottom: 45, width: 20 },
        { width: 260, height: 80 },
        { width: 320, height: 100 },
      ),
    ).toEqual({ left: 52, top: 12 }));
  it("positions the portal using the measured word and tooltip dimensions", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("role") === "tooltip"
          ? {
              x: 0,
              y: 0,
              left: 0,
              top: 0,
              right: 120,
              bottom: 40,
              width: 120,
              height: 40,
              toJSON: () => ({}),
            }
          : {
              x: 200,
              y: 100,
              left: 200,
              top: 100,
              right: 250,
              bottom: 125,
              width: 50,
              height: 25,
              toJSON: () => ({}),
            };
      },
    );
    const user = userEvent.setup();
    render(<ContextSentence word={word} />);
    await user.click(screen.getByRole("button", { name: "Перевод слова We" }));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.style.left).toBe("165px");
    expect(tooltip.style.top).toBe("52px");
    expect(
      within(
        document.querySelector(".context-sentence") as HTMLElement,
      ).queryByRole("tooltip"),
    ).toBeNull();
  });
});
