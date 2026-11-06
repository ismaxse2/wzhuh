import { RingProgress } from "../../../shared/ui";
import { useVocabulary } from "../model/context";
import type { WordSet } from "../model/types";
export function SetProgress({
  set,
  format = "percent",
}: {
  set: WordSet;
  format?: "percent" | "count";
}) {
  const { data } = useVocabulary();
  const learned = set.words.filter(
    (w) => data.progress[w.vocabularyId]?.status === "learned",
  ).length;
  const percent = set.words.length
    ? Math.round((learned / set.words.length) * 100)
    : 0;
  return (
    <RingProgress
      className="set-card-progress"
      label={`Прогресс набора ${set.title}`}
      value={percent}
      valueText={
        format === "count"
          ? `Изучено ${learned} из ${set.words.length} слов`
          : undefined
      }
    >
      {format === "count" ? `${learned}/${set.words.length}` : `${percent}%`}
    </RingProgress>
  );
}
