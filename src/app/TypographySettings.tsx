import { useLayoutEffect } from "react";

import { useVocabulary } from "../entities/vocabulary";

const sizes = { normal: "16px", large: "18px", "extra-large": "20px" };

export function TypographySettings() {
  const { data } = useVocabulary();
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = sizes[data.settings.fontSize];
    return () => {
      root.style.fontSize = previous;
    };
  }, [data.settings.fontSize]);
  return null;
}
