import type { ApiErrorBody } from "./errors";
import type { PriorQuestion } from "./schemas";
import type {
  CorpusPart,
  FileUpdate,
  GradeResult,
  MaterialAnalysis,
  Question,
  QuizConfig,
  Topic,
  UserResponse,
} from "./types";

export class ClientApiError extends Error {
  readonly code: string;
  readonly details: string[];

  constructor(message: string, code = "internal", details: string[] = []) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ClientApiError("No pude conectarme con el servidor. ¿Sigue corriendo `npm run dev`?", "network");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ClientApiError(
      error?.message ?? `El servidor respondió con un error (${response.status}).`,
      error?.code,
      error?.details ?? [],
    );
  }
  return body as T;
}

export interface AnalyzeResponse {
  analysis: MaterialAnalysis;
  corpus: CorpusPart[];
  notes: string[];
}

export function analyzeFiles(files: File[]): Promise<AnalyzeResponse> {
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  return call<AnalyzeResponse>("/api/analyze", { method: "POST", body: form });
}

export interface QuizRequest {
  corpus: CorpusPart[];
  knowledge: { title: string; language: string; topics: Topic[] };
  config: QuizConfig;
  count: number;
  existing: PriorQuestion[];
  history: PriorQuestion[];
}

export interface QuizResponse {
  questions: Question[];
  exhausted: boolean;
  fileUpdates: FileUpdate[];
}

export function requestQuestions(payload: QuizRequest): Promise<QuizResponse> {
  return call<QuizResponse>("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function requestGrade(payload: { question: Question; response: UserResponse; final: boolean }): Promise<GradeResult> {
  return call<GradeResult>("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
