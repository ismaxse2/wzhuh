import "./set-modal.css";

import { Plus, X } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import {
  addWords,
  SetProgress,
  useVocabulary,
  type Word,
  type WordSet,
  WordTranslation,
} from "../../../entities/vocabulary";
import { Button, IconButton } from "../../../shared/ui";
export function SetWordsModal({
  set,
  onClose,
}: {
  set?: WordSet;
  onClose: () => void;
}) {
  const { data, update, error, blocked } = useVocabulary();
  const dialogRef = useRef<HTMLDialogElement>(null),
    closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listAreaRef = useRef<HTMLDivElement>(null);
  const updateScrollFade = () => {
    const list = listRef.current;
    listAreaRef.current?.classList.toggle(
      "has-more-below",
      !!list && list.scrollHeight - list.clientHeight - list.scrollTop > 1,
    );
  };
  const titleId = useId();
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    updateScrollFade();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateScrollFade)
        : null;
    observer?.observe(list);
    for (const item of list.children) observer?.observe(item);
    window.addEventListener("resize", updateScrollFade);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScrollFade);
    };
  }, [set, data.progress]);
  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const add = (words: Word[]) => {
    if (!set) return;
    update((current) => {
      const next = addWords(current, words);
      return next.selectedSets.includes(set.id)
        ? next
        : { ...next, selectedSets: [...next.selectedSets, set.id] };
    });
  };
  const available = set?.words.some((w) => !data.progress[w.vocabularyId]);
  return createPortal(
    <dialog
      ref={dialogRef}
      className="set-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key !== "Tab") return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="set-modal-content">
        <header className="set-modal-header">
          {set && <SetProgress set={set} format="count" />}
          <h2 id={titleId}>{set?.title ?? "Набор не найден"}</h2>
          <IconButton
            variant="plain"
            ref={closeRef}
            type="button"
            className="set-modal-close"
            aria-label="Закрыть набор"
            onClick={onClose}
          >
            <X size={23} aria-hidden="true" />
          </IconButton>
        </header>
        {error && (
          <p className="set-modal-error" role="alert">
            {error}
          </p>
        )}
        {set?.words.length ? (
          <div className="set-modal-list-area" ref={listAreaRef}>
            <ul
              ref={listRef}
              onScroll={updateScrollFade}
              className="set-modal-list"
              aria-label="Слова набора"
            >
              {set.words.map((word) => {
                const p = data.progress[word.vocabularyId];
                return (
                  <li key={word.id} className="set-modal-word">
                    <div className="set-modal-word-copy">
                      <div>
                        <strong lang="en">{word.word}</strong>
                        {p?.status === "learned" && (
                          <span className="set-modal-learned">Изучено</span>
                        )}
                      </div>
                      <small>
                        <WordTranslation word={word} />
                      </small>
                    </div>
                    {p ? (
                      <span className="set-modal-added">Добавлено</span>
                    ) : (
                      <Button
                        variant="primary"
                        type="button"
                        className="set-modal-add"
                        aria-label={`Добавить ${word.word}`}
                        disabled={blocked}
                        onClick={() => add([word])}
                      >
                        Добавить <Plus size={12} aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="set-modal-empty">
            {set
              ? "В наборе пока нет слов"
              : "Этот набор недоступен. Выберите другой в каталоге."}
          </p>
        )}
        {set && (
          <div className="set-modal-footer">
            {available ? (
              <Button
                variant="primary"
                type="button"

                disabled={blocked}
                onClick={() => add(set.words)}
              >
                Добавить весь набор
              </Button>
            ) : (
              !!set.words.length && (
                <span className="set-modal-all-added">Весь набор добавлен</span>
              )
            )}
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
