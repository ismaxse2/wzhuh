import "./context-sentence.css";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  contextSegments,
  type ExampleToken,
  tooltipPosition,
  type Word,
} from "../../../entities/vocabulary";

interface ActiveWord {
  id: string;
  translation: string;
  anchor: HTMLButtonElement;
}
export function ContextSentence({
  word,
  revealed = false,
}: {
  word: Word;
  revealed?: boolean;
}) {
  // A new sentence or revealed answer gets an independent tooltip lifecycle.
  return (
    <Sentence
      key={`${word.id}:${word.example}:${revealed}`}
      word={word}
      revealed={revealed}
    />
  );
}
function Sentence({ word, revealed }: { word: Word; revealed: boolean }) {
  const [active, setActive] = useState<ActiveWord | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const segments = contextSegments(word);
  useLayoutEffect(() => {
    if (!active || !tooltipRef.current) return;
    const tooltip = tooltipRef.current;
    const position = tooltipPosition(
      active.anchor.getBoundingClientRect(),
      tooltip.getBoundingClientRect(),
      {
        width: document.documentElement.clientWidth || window.innerWidth,
        height: window.innerHeight,
      },
    );
    tooltip.style.left = `${position.left}px`;
    tooltip.style.top = `${position.top}px`;
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const close = () => setActive(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !active.anchor.contains(event.target) &&
        !tooltipRef.current?.contains(event.target)
      )
        close();
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [active]);
  const renderTokens = (tokens: ExampleToken[], side: string) =>
    tokens.map((token, index) => {
      const id = `${side}:${index}`;
      if (!token.translation) return <span key={id}>{token.text}</span>;
      return (
        <button
          key={id}
          type="button"
          className={`context-word ${active?.id === id ? "is-open" : ""}`}
          aria-label={`Перевод слова ${token.text}`}
          aria-describedby={active?.id === id ? tooltipId : undefined}
          aria-expanded={active?.id === id}
          onClick={(event) => {
            const anchor = event.currentTarget;
            setActive((current) =>
              current?.id === id
                ? null
                : { id, anchor, translation: token.translation! },
            );
          }}
          onBlur={() =>
            setActive((current) => (current?.id === id ? null : current))
          }
        >
          {token.text}
        </button>
      );
    });
  return (
    <div className="context-sentence" lang="en">
      {segments ? (
        <>
          {renderTokens(segments.before, "before")}
          <span className="blank">
            {revealed ? (word.contextAnswer ?? word.word) : "________"}
          </span>
          {renderTokens(segments.after, "after")}
        </>
      ) : (
        <>Введите слово: «{word.translation}»</>
      )}
      {active &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            lang="ru"
            className="word-translation-tooltip"
          >
            {active.translation}
          </div>,
          document.body,
        )}
    </div>
  );
}
