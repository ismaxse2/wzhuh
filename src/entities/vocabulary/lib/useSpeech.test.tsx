// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VocabularyProvider } from "../../../app/VocabularyProvider";
import { SettingsPage } from "../../../pages/SettingsPage";
import { emptyData } from "../model/storage/model";
import { storageService } from "../model/storage/storageService";
import { SpeechButton } from "../ui/SpeechButton";
import { useSpeech } from "./useSpeech";
const us = { lang: "en-US", name: "US" } as SpeechSynthesisVoice;
const gb = { lang: "en-GB", name: "GB" } as SpeechSynthesisVoice;
let voices: SpeechSynthesisVoice[] = [];
let onVoices: () => void;
const cancel = vi.fn(),
  speak = vi.fn();
beforeEach(() => {
  window.localStorage.clear();
  voices = [];
  cancel.mockClear();
  speak.mockClear();
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
      lang = "";
      voice = null;
      rate = 1;
    },
  );
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => voices,
    cancel,
    speak,
    addEventListener: (_name: string, listener: () => void) => {
      onVoices = listener;
    },
    removeEventListener: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("browser speech", () => {
  it("loads voices asynchronously, selects accent and cancels before every utterance", () => {
    const { result } = renderHook(() => useSpeech(), {
      wrapper: VocabularyProvider,
    });
    voices = [gb, us];
    act(() => onVoices());
    act(() => result.current.speak("hello"));
    expect(speak.mock.calls[0][0]).toMatchObject({
      text: "hello",
      lang: "en-US",
      voice: us,
    });
    act(() => result.current.speak("world"));
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenCalledTimes(2);
  });
  it("falls back to any available English voice", () => {
    const d = emptyData();
    d.settings.accent = "en-GB";
    storageService.save(d);
    voices = [us];
    const { result } = renderHook(() => useSpeech(), {
      wrapper: VocabularyProvider,
    });
    act(() => result.current.speak("coffee"));
    expect(speak.mock.calls[0][0]).toMatchObject({ voice: us, lang: "en-GB" });
  });
  it("keeps browser default when no matching voice exists", () => {
    const { result } = renderHook(() => useSpeech(), {
      wrapper: VocabularyProvider,
    });
    act(() => result.current.speak("hello"));
    expect(speak.mock.calls[0][0].voice).toBeNull();
  });
  it("allows manual playback with autoplay disabled", () => {
    const d = emptyData();
    d.settings.speechEnabled = false;
    storageService.save(d);
    const { result } = renderHook(() => useSpeech(), {
      wrapper: VocabularyProvider,
    });
    act(() => result.current.speak("hello"));
    expect(result.current.enabled).toBe(true);
    expect(speak).toHaveBeenCalledTimes(1);
  });
});

describe("automatic pronunciation", () => {
  it("plays once in StrictMode and does not replay when voices load or the card rerenders", () => {
    vi.useFakeTimers();
    voices = [us];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <VocabularyProvider>{children}</VocabularyProvider>
      </StrictMode>
    );
    const { rerender } = renderHook(({ text }) => useSpeech(text), {
      wrapper,
      initialProps: { text: "coffee" },
    });
    act(() => vi.advanceTimersByTime(0));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toMatchObject({ text: "coffee", voice: us });
    voices = [gb, us];
    act(() => onVoices());
    rerender({ text: "coffee" });
    act(() => vi.advanceTimersByTime(0));
    expect(speak).toHaveBeenCalledTimes(1);
    rerender({ text: "hello" });
    act(() => vi.advanceTimersByTime(0));
    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak.mock.calls[1][0].text).toBe("hello");
  });
  it("does not autoplay with speech disabled", () => {
    vi.useFakeTimers();
    const data = emptyData();
    data.settings.speechEnabled = false;
    storageService.save(data);
    renderHook(() => useSpeech("coffee"), { wrapper: VocabularyProvider });
    act(() => vi.advanceTimersByTime(0));
    expect(speak).not.toHaveBeenCalled();
  });
  it("cancels pending autoplay when the card closes", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useSpeech("coffee"), {
      wrapper: VocabularyProvider,
    });
    unmount();
    act(() => vi.advanceTimersByTime(0));
    expect(speak).not.toHaveBeenCalled();
  });
});

describe("manual speech controls", () => {
  it("keeps word and settings preview buttons working with autoplay off", () => {
    const data = emptyData();
    data.settings.speechEnabled = false;
    storageService.save(data);
    render(
      <VocabularyProvider>
        <SpeechButton text="coffee" />
        <SettingsPage />
      </VocabularyProvider>,
    );
    const wordButton = screen.getByRole("button", {
      name: "Прослушать",
    }) as HTMLButtonElement;
    const preview = screen.getByRole("button", {
      name: "Послушать пример",
    }) as HTMLButtonElement;
    expect(wordButton.disabled).toBe(false);
    expect(preview.disabled).toBe(false);
    fireEvent.click(wordButton);
    fireEvent.click(preview);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak.mock.calls[0][0].text).toBe("coffee");
    expect(
      screen
        .getByRole("switch", { name: "Автоматическое озвучивание" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });
  it("disables controls when speech APIs are unavailable", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    // Presence of both APIs is the browser capability check.
    Reflect.deleteProperty(window, "speechSynthesis");
    render(
      <VocabularyProvider>
        <SpeechButton text="coffee" />
        <SettingsPage />
      </VocabularyProvider>,
    );
    expect(
      (screen.getByRole("button", { name: "Прослушать" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Послушать пример",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
