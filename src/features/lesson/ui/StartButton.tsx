import { ArrowRight, Play, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  allWords,
  quickLessonWords,
  startLesson,
  useVocabulary,
  type Word,
  type WordSet,
} from "../../../entities/vocabulary";
import { Button } from "../../../shared/ui";
export function StartButton({
  words,
  set,
  children,
  className = "",
}: {
  words?: Word[];
  set?: WordSet;
  children?: React.ReactNode;
  className?: string;
}) {
  const { data, update, blocked } = useVocabulary();
  const navigate = useNavigate();
  const active = data.activeSession?.status === "active";
  const selected =
    words ?? (set ? set.words : quickLessonWords(data, allWords));
  const start = () => {
    if (active) {
      navigate("/words/learn");
      return;
    }
    if (!selected.length) {
      navigate("/words");
      return;
    }
    if (
      update((d) =>
        startLesson(
          d,
          selected,
          set ? "set" : words ? "dictionary" : "daily",
          new Date(),
          set?.id,
        ),
      )
    )
      navigate("/words/learn");
  };
  return (
    <Button
      className={className}
      disabled={blocked || (!!words && !words.length && !active)}
      onClick={start}
    >
      {active ? (
        <RotateCcw size={17} />
      ) : (
        <Play size={16} fill="currentColor" />
      )}
      {active
        ? "РџСЂРѕРґРѕР»Р¶РёС‚СЊ СѓСЂРѕРє"
        : (children ??
          (selected.length
            ? "РќР°С‡Р°С‚СЊ СѓСЂРѕРє"
            : "Р’С‹Р±СЂР°С‚СЊ РЅР°Р±РѕСЂ"))}
      <ArrowRight size={17} />
    </Button>
  );
}
