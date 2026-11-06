import type { Word } from "../model/types";

export function WordTranslation({ word }: { word: Word }) {
  return (
    <>
      <span>{word.translation}</span>
      {word.alternativeTranslations.length > 0 && (
        <span className="alternative-translations">
          ; {word.alternativeTranslations.join("; ")}
        </span>
      )}
    </>
  );
}
