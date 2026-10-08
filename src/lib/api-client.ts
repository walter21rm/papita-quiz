import { upload } from "@vercel/blob/client";
import type { ApiErrorBody } from "./errors";
import { LIMITS, mimeForFile } from "./labels";
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
    if (response.status === 504) {
      throw new ClientApiError(
        "El análisis tardó demasiado porque Gemini está saturado. Vuelve a intentarlo en un minuto.",
        "ai_unavailable",
      );
    }
    if (response.status === 413) {
      throw new ClientApiError(
        "El archivo es demasiado grande para una sola subida. Papita lo enviará por partes; si ves este aviso, recarga e inténtalo de nuevo.",
        "bad_request",
      );
    }
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

async function uploadLargeFile(file: File) {
  try {
    const blob = await upload(file.name, file, {
      access: "private",
      handleUploadUrl: "/api/files/blob",
      contentType: mimeForFile(file.name, file.type),
      multipart: file.size > LIMITS.geminiChunkBytes,
    });
    return { url: blob.url, name: file.name, size: file.size, mimeType: blob.contentType || mimeForFile(file.name, file.type) };
  } catch (error) {
    if (error instanceof ClientApiError) throw error;
    throw new ClientApiError("No pude subir el archivo. Vuelve a intentarlo en un momento.", "ai_unavailable");
  }
}

export async function analyzeFiles(files: File[]): Promise<AnalyzeResponse> {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total <= LIMITS.gatewayBytes) {
    const form = new FormData();
    for (const file of files) form.append("files", file, file.name);
    return call<AnalyzeResponse>("/api/analyze", { method: "POST", body: form });
  }
  const blobs = [];
  for (const file of files) blobs.push(await uploadLargeFile(file));
  return call<AnalyzeResponse>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blobs }),
  });
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
