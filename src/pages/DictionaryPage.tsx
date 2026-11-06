import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  allWords,
  changeWordStatus,
  SpeechButton,
  useVocabulary,
  wordSets,
  WordTranslation,
} from "../entities/vocabulary";
import { StartButton } from "../features/lesson";
import { Checkbox, SearchField, Select, TabButton, Tabs } from "../shared/ui";

export function DictionaryPage() {
  const { data, now, update, blocked } = useVocabulary();
  const [filter, setFilter] = useState<"all" | "learning" | "learned">("all");
  const [setId, setSetId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const words = allWords.filter((w) => data.progress[w.vocabularyId]);
  const setVocabularyIds = setId
    ? new Set(
        wordSets
          .find((set) => set.id === setId)
          ?.words.map((w) => w.vocabularyId),
      )
    : null;
  const setWords = words.filter(
    (w) => !setVocabularyIds || setVocabularyIds.has(w.vocabularyId),
  );
  const filtered = setWords.filter(
    (w) =>
      (filter === "all" || data.progress[w.vocabularyId].status === filter) &&
      `${w.word} ${w.translation} ${w.alternativeTranslations.join(" ")} ${w.acceptedAnswers.join(" ")}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const selected = words.filter((w) => selectedIds.includes(w.vocabularyId));
  const allChecked =
    filtered.length > 0 &&
    filtered.every((w) => selectedIds.includes(w.vocabularyId));
  const statuses = [
    ["all", "Все"],
    ["learning", "На изучении"],
    ["learned", "Изучены"],
  ] as const;
  return (
    <div
      className={`dictionary-page${selected.length ? " has-selection" : ""}`}
    >
      <div className="page-heading">
        <div>
          <h1>Мои слова</h1>
        </div>
        <Link to="/words" className="text-link">
          <Plus size={16} />
          Добавить слова
        </Link>
      </div>
      <div className="catalog-toolbar dictionary-toolbar">
        <Tabs aria-label="Фильтр слов">
          {statuses.map(([value, label]) => (
            <TabButton
              key={value}
              selected={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
              <span>
                {
                  setWords.filter(
                    (w) =>
                      value === "all" ||
                      data.progress[w.vocabularyId].status === value,
                  ).length
                }
              </span>
            </TabButton>
          ))}
        </Tabs>
        <Select
          variant="compact"
          className="dictionary-set-filter"
          aria-label="Фильтр по набору"
          value={setId}
          onChange={(event) => setSetId(event.target.value)}
        >
          <option value="">Все наборы</option>
          {wordSets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.title}
            </option>
          ))}
        </Select>
        <SearchField
          aria-label="Поиск по словарю"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Слово или перевод…"
        />
      </div>
      {filtered.length ? (
        <div className="word-table panel">
          <div className="word-table-head">
            <label className="word-select-all">
              <Checkbox
                aria-label="Выбрать видимые"
                indeterminate={
                  !allChecked &&
                  filtered.some((w) => selectedIds.includes(w.vocabularyId))
                }
                checked={allChecked}
                onChange={(e) =>
                  setSelectedIds((s) =>
                    e.target.checked
                      ? [
                          ...new Set([
                            ...s,
                            ...filtered.map((w) => w.vocabularyId),
                          ]),
                        ]
                      : s.filter(
                          (id) => !filtered.some((w) => w.vocabularyId === id),
                        ),
                  )
                }
              />
              <span>СЛОВО</span>
            </label>
            <span>ПЕРЕВОД</span>
            <span>СТАТУС</span>
          </div>
          {filtered.map((w) => {
            const p = data.progress[w.vocabularyId];
            return (
              <div className="word-row" key={w.vocabularyId}>
                <div className="word-cell">
                  <Checkbox
                    aria-label={`Выбрать ${w.word}`}
                    checked={selectedIds.includes(w.vocabularyId)}
                    onChange={(e) =>
                      setSelectedIds((s) =>
                        e.target.checked
                          ? [...s, w.vocabularyId]
                          : s.filter((id) => id !== w.vocabularyId),
                      )
                    }
                  />
                  <SpeechButton text={w.word} />
                  <div>
                    <div className="dictionary-word-label">
                      <strong lang="en">{w.word}</strong>
                      <span className="dictionary-mobile-translation">
                        <WordTranslation word={w} />
                      </span>
                    </div>
                    <small>{w.transcription}</small>
                  </div>
                </div>
                <span>
                  <WordTranslation word={w} />
                </span>
                <div>
                  <Select
                    variant="badge"
                    tone={p.status === "learned" ? "success" : "accent"}
                    aria-label={`Статус слова ${w.word}`}
                    value={p.status}
                    disabled={blocked}
                    onChange={(event) => {
                      const status = event.target.value;
                      if (status === "learning" || status === "learned")
                        update((current) =>
                          changeWordStatus(
                            current,
                            w.vocabularyId,
                            status,
                            now,
                          ),
                        );
                    }}
                  >
                    <option value="learning">На изучении</option>
                    <option value="learned">Изучено</option>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state panel">
          <BookOpen size={32} />
          <h2>{words.length ? "Слова не найдены" : "Словарь пока пуст"}</h2>
          <p>
            {words.length
              ? "Измените фильтр или поисковый запрос."
              : "Добавьте слова из наборов"}
          </p>
          <Link className="button primary" to="/words">
            Открыть наборы
          </Link>
        </div>
      )}
      {!!selected.length && (
        <div
          className="dictionary-selection-bar"
          role="region"
          aria-label="Выбранные слова"
        >
          <div className="dictionary-selection-inner">
            <span aria-live="polite">Выбрано: {selected.length}</span>
            <button className="text-button" onClick={() => setSelectedIds([])}>
              Снять выбор
            </button>
            <StartButton words={selected}>Учить выбранные</StartButton>
          </div>
        </div>
      )}
    </div>
  );
}
