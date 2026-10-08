export const LEVELS = ["basico", "intermedio", "avanzado", "experto"] as const;
export type Level = (typeof LEVELS)[number];

export const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "short_answer",
  "open_ended",
  "matching",
  "ordering",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface TextPart {
  kind: "text";
  label: string;
  text: string;
}

export interface MediaPart {
  kind: "media";
  label: string;
  mediaType: "document" | "image";
  mimeType: string;
  size: number;
  data: string;
  fileUri?: string;
  fileExpiresAt?: number;
}

export type CorpusPart = TextPart | MediaPart;

export interface FileUpdate {
  index: number;
  fileUri: string;
  fileExpiresAt: number;
}

export interface Concept {
  id: string;
  name: string;
  explanation: string;
  keyFacts: string[];
  source: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  importance: number;
  concepts: Concept[];
}

export interface MaterialAnalysis {
  title: string;
  materialType: string;
  language: string;
  summary: string;
  topics: Topic[];
  warnings: string[];
  capacity: Record<Level, number>;
}

export interface MaterialFile {
  name: string;
  size: number;
  type: string;
  hash: string;
}

export interface Material {
  id: string;
  fingerprint: string;
  title: string;
  files: MaterialFile[];
  analysis: MaterialAnalysis;
  processingNotes: string[];
  createdAt: number;
  updatedAt: number;
}

/** The processed content sent to the AI, stored apart from Material because it can be large. */
export interface MaterialCorpus {
  materialId: string;
  parts: CorpusPart[];
}

export interface Question {
  id: string;
  type: QuestionType;
  level: Level;
  prompt: string;
  options?: { id: string; text: string }[];
  correctOptionIds?: string[];
  correctBoolean?: boolean;
  blanks?: { accepted: string[] }[];
  acceptedAnswers?: string[];
  pairs?: { left: string; right: string }[];
  orderedItems?: string[];
  rubric?: string[];
  modelAnswer: string;
  hints: string[];
  explanation: string;
  source: string;
  conceptIds: string[];
}

export type QuizLanguage = "es" | "original";

export interface QuizConfig {
  level: Level;
  count: number;
  types: QuestionType[];
  topicIds: string[];
  language: QuizLanguage;
  focusConceptIds: string[];
}

export type QuizStatus = "generating" | "ready" | "error";

export interface Quiz {
  id: string;
  materialId: string;
  config: QuizConfig;
  questions: Question[];
  targetCount: number;
  status: QuizStatus;
  error?: string;
  exhausted: boolean;
  createdAt: number;
}

export type UserResponse =
  | { type: "single_choice"; optionId: string | null }
  | { type: "multiple_choice"; optionIds: string[] }
  | { type: "true_false"; value: boolean | null }
  | { type: "fill_blank"; values: string[] }
  | { type: "short_answer"; text: string }
  | { type: "open_ended"; text: string }
  | { type: "matching"; matches: (number | null)[] }
  | { type: "ordering"; order: number[] };

export type Verdict = "correct" | "partial" | "incorrect";

export interface GradeResult {
  verdict: Verdict;
  score: number;
  feedback?: string;
  blankResults?: boolean[];
}

export interface AnswerRecord {
  questionId: string;
  response: UserResponse;
  checks: number;
  hintsUsed: number;
  gaveUp: boolean;
  verdict: Verdict;
  rawScore: number;
  score: number;
  feedback?: string;
  blankResults?: boolean[];
  done: boolean;
}

export interface Attempt {
  id: string;
  quizId: string;
  materialId: string;
  answers: Record<string, AnswerRecord>;
  currentIndex: number;
  startedAt: number;
  finishedAt?: number;
  score?: number;
  grade20?: number;
}

export interface QuestionHistoryEntry {
  id: string;
  materialId: string;
  quizId: string;
  level: Level;
  type: QuestionType;
  prompt: string;
  answer: string;
  conceptIds: string[];
  createdAt: number;
}

export interface HistoryDigest {
  prompts: string[];
  conceptCounts: Record<string, number>;
}
