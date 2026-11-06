import { createContext, useContext } from "react";

import type { UserData } from "./types";
export interface VocabularyContextValue {
  data: UserData;
  update: (change: (current: UserData) => UserData) => boolean;
  error: string | null;
  blocked: boolean;
  dismissError: () => void;
  reset: () => boolean;
  now: Date;
}
export const VocabularyContext = createContext<VocabularyContextValue | null>(
  null,
);
export function useVocabulary() {
  const context = useContext(VocabularyContext);
  if (!context) throw new Error("VocabularyProvider missing");
  return context;
}
