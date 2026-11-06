import { BookOpen } from "lucide-react";
import { useState } from "react";

import { useVocabulary, wordSets } from "../entities/vocabulary";
import { SetCard } from "../features/word-sets";
import { SearchField, TabButton, Tabs } from "../shared/ui";

export function WordsPage() {
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const { data } = useVocabulary();
  const filtered = wordSets.filter(
    (s) =>
      (!onlySelected || data.selectedSets.includes(s.id)) &&
      `${s.title} ${s.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Словарные наборы</h1>
        </div>
      </div>
      <div className="catalog-toolbar">
        <Tabs aria-label="Фильтр наборов">
          <TabButton
            selected={!onlySelected}
            onClick={() => setOnlySelected(false)}
          >
            Все наборы <span>{wordSets.length}</span>
          </TabButton>
          <TabButton
            selected={onlySelected}
            onClick={() => setOnlySelected(true)}
          >
            Мои наборы{" "}
            <span>
              {
                wordSets.filter((set) => data.selectedSets.includes(set.id))
                  .length
              }
            </span>
          </TabButton>
        </Tabs>
        <SearchField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Найти тему…"
          aria-label="Поиск наборов"
        />
      </div>
      <div className="set-grid">
        {filtered.map((set) => (
          <SetCard key={set.id} set={set} />
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <BookOpen size={30} />
          <h2>Наборы не найдены</h2>
          <p>Попробуйте другой запрос или откройте все наборы.</p>
          <button
            className="button secondary"
            onClick={() => {
              setSearch("");
              setOnlySelected(false);
            }}
          >
            Показать все
          </button>
        </div>
      )}
    </>
  );
}
