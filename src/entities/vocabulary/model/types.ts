export type Stage = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Exercise =
  | "introduction"
  | "recognition"
  | "reverse"
  | "builder"
  | "spelling"
  | "context";
export interface ExampleToken {
  text: string;
  translation?: string;
}
export interface Word {
  id: string;
  vocabularyId: string;
  word: string;
  translation: string;
  alternativeTranslations: string[];
  acceptedAnswers: string[];
  partOfSpeech: string;
  transcription: string;
  example: string;
  exampleTranslation: string;
  contextAnswer?: string;
  contextDistractors: string[];
  exampleTokens?: ExampleToken[];
}
export interface WordSet {
  id: string;
  title: string;
  description: string;
  level: string;
  words: Word[];
}
export interface UserWordProgress {
  vocabularyId: string;
  status: "learning" | "learned";
  addedAt: string;
  learnedAt: string | null;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  correctAnswers: number;
  incorrectAnswers: number;
  retentionIntervalIndex: number;
}
export interface Settings {
  quickAddCount: number;
  speechEnabled: boolean;
  accent: "en-US" | "en-GB";
}
export interface LessonTask {
  id: string;
  vocabularyId: string;
  stage: Stage;
  exercise: Exercise;
}
export interface LessonAttempt {
  id: string;
  taskId: string;
}
export interface Answer {
  id: string;
  sessionId: string;
  taskId: string;
  vocabularyId: string;
  exercise: Exercise;
  stage: Stage;
  correct: boolean;
  at: string;
}
export type LessonStatus = "active" | "completed" | "endedEarly";
export interface SessionSummary {
  outcome: "completed" | "endedEarly";
  id: string;
  completedAt: string;
  exercises: number;
  correct: number;
  incorrect: number;
  learnedWords: number;
  wordCount: number;
}
export interface LearningSession {
  status: LessonStatus;
  id: string;
  mode: "daily" | "set" | "dictionary";
  setId?: string;
  wordIds: string[];
  tasks: LessonTask[];
  completedTaskIds: string[];
  queue: LessonAttempt[];
  index: number;
  startedAt: string;
  firstLearnedIds: string[];
}
export interface UserData {
  version: 2;
  progress: Record<string, UserWordProgress>;
  settings: Settings;
  answers: Answer[];
  introducedAt: Record<string, string>;
  sessions: SessionSummary[];
  selectedSets: string[];
  activeSession: LearningSession | null;
  migrationNotice: boolean;
}
