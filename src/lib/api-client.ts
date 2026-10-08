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

async function uploadFileInChunks(file: File) {
  const mimeType = mimeForFile(file.name, file.type);
  const started = await call<{ handle: string; mimeType: string }>("/api/files/begin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, mimeType, size: file.size }),
  });
  const chunkSize = LIMITS.uploadChunkBytes;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size);
    const form = new FormData();
    form.append("handle", started.handle);
    form.append("offset", String(offset));
    form.append("last", end >= file.size ? "1" : "0");
    form.append("chunk", file.slice(offset, end), file.name);
    const result = await call<{ ok?: boolean; file?: { fileUri: string; fileExpiresAt: number; mimeType: string; size: number } }>(
      "/api/files/chunk",
      { method: "POST", body: form },
    );
    if (result.file) {
      return {
        name: file.name,
        mimeType: result.file.mimeType || started.mimeType,
        size: file.size,
        fileUri: result.file.fileUri,
        fileExpiresAt: result.file.fileExpiresAt,
      };
    }
  }
  throw new ClientApiError("La subida del archivo no terminó. Vuelve a intentarlo.", "ai_unavailable");
}

export async function analyzeFiles(files: File[]): Promise<AnalyzeResponse> {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total <= LIMITS.gatewayBytes) {
    const form = new FormData();
    for (const file of files) form.append("files", file, file.name);
    return call<AnalyzeResponse>("/api/analyze", { method: "POST", body: form });
  }
  const remotes = [];
  for (const file of files) remotes.push(await uploadFileInChunks(file));
  return call<AnalyzeResponse>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remotes }),
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
