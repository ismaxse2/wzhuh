import { useCallback, useEffect, useRef, useState } from "react";

import { useVocabulary } from "../model/context";
export function useSpeech(autoPlayText?: string) {
  const { data } = useVocabulary();
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;
  const voices = useRef<SpeechSynthesisVoice[]>([]);
  const [speechError, setSpeechError] = useState<string | null>(null);
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => {
      voices.current = synth.getVoices();
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
    };
  }, [supported]);
  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = data.settings.accent;
        utterance.voice =
          voices.current.find(
            (v) => v.lang.toLowerCase() === data.settings.accent.toLowerCase(),
          ) ??
          voices.current.find((v) => v.lang.toLowerCase().startsWith("en")) ??
          null;
        utterance.rate = 0.85;
        utterance.onerror = (e) => {
          if (e.error !== "interrupted" && e.error !== "canceled")
            setSpeechError(
              "Не удалось воспроизвести звук. Проверьте голосовые пакеты браузера.",
            );
        };
        setSpeechError(null);
        window.speechSynthesis.speak(utterance);
      } catch {
        setSpeechError("Озвучивание сейчас недоступно.");
      }
    },
    [supported, data.settings.accent],
  );
  useEffect(() => {
    if (!autoPlayText || !supported || !data.settings.speechEnabled) return;
    // Defer until all card effects are mounted; StrictMode cleanup cancels its rehearsal.
    const timer = window.setTimeout(() => speak(autoPlayText), 0);
    return () => window.clearTimeout(timer);
  }, [autoPlayText, supported, data.settings.speechEnabled, speak]);
  return {
    speak,
    enabled: supported,
    supported,
    speechError,
  };
}
