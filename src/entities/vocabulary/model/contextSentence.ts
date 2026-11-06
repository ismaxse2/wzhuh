import type { ExampleToken, Word } from "./types";
import { contextParts } from "./wordExercises";
export interface ContextSegments {
  before: ExampleToken[];
  after: ExampleToken[];
}
/** Slice by source offsets, never giving a partial/hidden word its original translation. */
function sliceTokens(
  tokens: ExampleToken[],
  start: number,
  end: number,
): ExampleToken[] {
  let offset = 0;
  return tokens.flatMap((token) => {
    const tokenStart = offset;
    offset += token.text.length;
    const from = Math.max(start, tokenStart),
      to = Math.min(end, offset);
    if (from >= to) return [];
    const text = token.text.slice(from - tokenStart, to - tokenStart);
    return [
      {
        text,
        ...(from === tokenStart && to === offset && token.translation
          ? { translation: token.translation }
          : {}),
      },
    ];
  });
}
export function contextSegments(word: Word): ContextSegments | null {
  const answer = word.contextAnswer ?? word.word;
  const parts = contextParts(word.example, answer);
  if (!parts) return null;
  const tokens = word.exampleTokens;
  if (!tokens || tokens.map((t) => t.text).join("") !== word.example)
    return { before: [{ text: parts[0] }], after: [{ text: parts[1] }] };
  const start = parts[0].length,
    end = start + answer.length;
  return {
    before: sliceTokens(tokens, 0, start),
    after: sliceTokens(tokens, end, word.example.length),
  };
}
export interface TooltipRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}
export function tooltipPosition(
  anchor: TooltipRect,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const margin = 8,
    gap = 8;
  const left = Math.max(
    margin,
    Math.min(
      anchor.left + anchor.width / 2 - tooltip.width / 2,
      viewport.width - tooltip.width - margin,
    ),
  );
  const above = anchor.top - tooltip.height - gap;
  const preferred = above >= margin ? above : anchor.bottom + gap;
  const top = Math.max(
    margin,
    Math.min(preferred, viewport.height - tooltip.height - margin),
  );
  return { left, top };
}
