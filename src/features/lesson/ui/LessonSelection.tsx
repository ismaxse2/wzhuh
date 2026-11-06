import "./lesson-selection.css";

import { Plus, Shuffle, X, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  allWords,
  randomLearningWords,
  startLesson,
  useVocabulary,
} from "../../../entities/vocabulary";
import { Button } from "../../../shared/ui";
export function LessonSelection() {
  const { data, update, blocked } = useVocabulary();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const eligible = new Map(
    allWords
      .filter((w) => data.progress[w.vocabularyId]?.status === "learning")
      .map((w) => [w.vocabularyId, w]),
  );
  const selected = selectedIds.flatMap((id) => {
    const w = eligible.get(id);
    return w ? [w] : [];
  });
  const addOne = () => {
    const random = Math.random();
    setSelectedIds((ids) => {
      const available = [...eligible.keys()].filter((id) => !ids.includes(id));
      return available.length
        ? [...ids, available[Math.floor(random * available.length)]]
        : ids;
    });
  };
  const start = () => {
    if (!selected.length) return;
    let started = false;
    const saved = update((current) => {
      // Check eligibility again at the persistence boundary; the draft itself is never stored.
      if (
        !selected.every(
          (w) => current.progress[w.vocabularyId]?.status === "learning",
        )
      )
        return current;
      const next = startLesson(current, selected, "daily");
      started = next !== current;
      return next;
    });
    if (saved && started) navigate("/words/learn");
  };
  if (!eligible.size)
    return (
      <section
        className="lesson-selection"
        aria-labelledby="lesson-selection-heading"
      >
        <h1 id="lesson-selection-heading" className="lesson-selection-prompt">
          Чтобы начать учить слова, добавьте их в свой словарь из наборов ниже
        </h1>
      </section>
    );
  return (
    <section
      className="lesson-selection"
      aria-labelledby="lesson-selection-heading"
    >
      <h1
        id="lesson-selection-heading"
        className="lesson-selection-count"
        aria-live="polite"
      >
        Выбрано слов: <strong>{selected.length}</strong>
      </h1>
      {selected.length ? (
        <ul className="selected-word-tags" aria-label="Слова для урока">
          {selected.map((word) => (
            <li key={word.vocabularyId} className="selected-word-tag">
              <span lang="en">{word.word}</span>
              <button
                type="button"
                aria-label={`Убрать ${word.word} из урока`}
                onClick={() =>
                  setSelectedIds((ids) =>
                    ids.filter((id) => id !== word.vocabularyId),
                  )
                }
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
          {!blocked && selected.length < eligible.size && (
            <li className="selected-word-add-item">
              <button
                type="button"
                className="selected-word-tag selected-word-add"
                onClick={addOne}
                title="Добавить случайное слово"
              >
                <Plus size={14} aria-hidden="true" />
                <span>Добавить</span>
              </button>
            </li>
          )}
        </ul>
      ) : (
        <p className="lesson-selection-empty">
          Добавьте случайные слова из своего словаря или{" "}
          <Link to="/dictionary" className="text-link">
            выберите сами
          </Link>
        </p>
      )}
      <div className="lesson-selection-actions">
        {selected.length ? (
          <Button
            variant="primary"
            type="button"
            className="selection-start"
            disabled={blocked}
            onClick={start}
          >
            Учить <Zap size={15} aria-hidden="true" />
          </Button>
        ) : (
          <button
            type="button"
            className="button selection-random"
            disabled={!eligible.size || blocked}
            onClick={() =>
              setSelectedIds(
                randomLearningWords(data, allWords).map((w) => w.vocabularyId),
              )
            }
          >
            <Shuffle size={15} aria-hidden="true" />
            Случайные слова
          </button>
        )}
      </div>
    </section>
  );
}
