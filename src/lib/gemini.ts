import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AppError } from "./errors";
import type { CorpusPart, FileUpdate, MediaPart } from "./types";

export const MODELS = {
  main: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
  fast: process.env.GEMINI_FAST_MODEL?.trim() || "gemini-3.5-flash-lite",
};

const INLINE_PART_LIMIT = 15 * 1024 * 1024;
const INLINE_TOTAL_LIMIT = 20 * 1024 * 1024;
const FILE_URI_SAFETY_MARGIN_MS = 30 * 60 * 1000;
const FILE_DEFAULT_LIFETIME_MS = 47 * 60 * 60 * 1000;

type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export type InputContent =
  | { type: "text"; text: string }
  | { type: "image"; mime_type: string; data?: string; uri?: string; resolution?: "low" | "medium" | "high" }
  | { type: "document"; mime_type: string; data?: string; uri?: string };

let client: GoogleGenAI | null = null;

/** Throws a friendly error before doing any expensive work when the API key is missing. */
export function assertApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      "missing_key",
      "Falta tu API key de Gemini. Copia .env.example como .env.local, pega tu clave en GEMINI_API_KEY y reinicia el servidor.",
    );
  }
  return apiKey;
}

function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: assertApiKey() });
  return client;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { statusCode?: unknown; status?: unknown; code?: unknown };
  for (const value of [candidate.statusCode, candidate.status, candidate.code]) {
    if (typeof value === "number") return value;
  }
  return undefined;
}

function toAppError(error: unknown, model: string): AppError {
  if (error instanceof AppError) return error;
  const status = errorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("api key not valid") || lower.includes("api_key_invalid") || status === 401) {
    return new AppError("invalid_key", "Tu API key de Gemini no es válida. Revisa GEMINI_API_KEY en .env.local.");
  }
  if (status === 403 || lower.includes("permission_denied")) {
    return new AppError("invalid_key", "Gemini rechazó la API key o no tiene permiso para usar este modelo.");
  }
  if (status === 404 || (lower.includes("model") && lower.includes("not found"))) {
    return new AppError(
      "model_unavailable",
      `El modelo "${model}" no está disponible para tu cuenta. Cambia GEMINI_MODEL o GEMINI_FAST_MODEL en .env.local.`,
    );
  }
  if (status === 429 || lower.includes("resource_exhausted") || lower.includes("quota")) {
    return new AppError(
      "rate_limited",
      "Gemini está ocupado o llegaste al límite gratuito por ahora. Espera un minuto y vuelve a intentarlo.",
    );
  }
  if (status !== undefined && status >= 500) {
    return new AppError("ai_unavailable", "Gemini tuvo un problema temporal. Vuelve a intentarlo en unos segundos.");
  }
  if (status === 400 || status === 413) {
    return new AppError("bad_request", `Gemini no pudo procesar el material: ${message}`);
  }
  console.error("[papita-quiz] Error de Gemini:", error);
  return new AppError("ai_unavailable", "No pude comunicarme con Gemini. Revisa tu conexión a internet.");
}

function isRetryable(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === undefined) return !(error instanceof AppError);
  return status === 429 || status >= 500;
}

async function withRetry<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1 || !isRetryable(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 2000 * 3 ** attempt));
    }
  }
  throw lastError;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)?.[1];
    const candidate = fenced ?? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      throw new AppError("ai_bad_response", "La respuesta de la IA llegó incompleta. Vuelve a intentarlo.");
    }
  }
}

export async function generateJson(options: {
  model: string;
  system: string;
  input: InputContent[];
  schema: Record<string, unknown>;
  thinking: ThinkingLevel;
}): Promise<unknown> {
  const ai = getClient();
  try {
    const interaction = await withRetry(() =>
      ai.interactions.create({
        model: options.model,
        system_instruction: options.system,
        input: options.input,
        response_format: { type: "text", mime_type: "application/json", schema: options.schema },
        generation_config: { thinking_level: options.thinking },
      }),
    );
    if (interaction.status && interaction.status !== "completed") {
      throw new AppError(
        "ai_bad_response",
        interaction.status === "incomplete"
          ? "La respuesta de la IA quedó cortada (el material es muy grande). Prueba con menos archivos o menos preguntas."
          : "La IA no pudo terminar la respuesta. Vuelve a intentarlo.",
      );
    }
    return parseJson(interaction.output_text ?? "");
  } catch (error) {
    throw toAppError(error, options.model);
  }
}

async function uploadMedia(part: MediaPart): Promise<{ uri: string; expiresAt: number }> {
  const ai = getClient();
  const blob = new Blob([Buffer.from(part.data, "base64")], { type: part.mimeType });
  let file = await withRetry(() =>
    ai.files.upload({ file: blob, config: { mimeType: part.mimeType, displayName: part.label.slice(0, 500) } }),
  );
  const deadline = Date.now() + 120_000;
  while (file.state === "PROCESSING" && file.name && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await ai.files.get({ name: file.name });
  }
  if (!file.uri || file.state === "FAILED") {
    throw new AppError("ai_unavailable", `Gemini no pudo recibir el archivo ${part.label}. Vuelve a intentarlo.`);
  }
  const expiresAt = file.expirationTime ? Date.parse(file.expirationTime) : Date.now() + FILE_DEFAULT_LIFETIME_MS;
  return { uri: file.uri, expiresAt };
}

/**
 * Turns stored corpus parts into Interactions API input. Large media goes through the Files API
 * (kept for ~48 h); the returned updates let the client store the URIs and reuse them.
 */
export async function corpusToInput(parts: CorpusPart[]): Promise<{ input: InputContent[]; updates: FileUpdate[] }> {
  const input: InputContent[] = [];
  const updates: FileUpdate[] = [];
  let inlineBytes = 0;

  try {
    for (const [index, part] of parts.entries()) {
      input.push({ type: "text", text: `[Parte ${index + 1}] ${part.label}` });
      if (part.kind === "text") {
        input.push({ type: "text", text: part.text });
        continue;
      }

      const validUri =
        part.fileUri && part.fileExpiresAt && part.fileExpiresAt - Date.now() > FILE_URI_SAFETY_MARGIN_MS
          ? part.fileUri
          : undefined;
      let uri = validUri;
      if (!uri && (part.size > INLINE_PART_LIMIT || inlineBytes + part.size > INLINE_TOTAL_LIMIT)) {
        const uploaded = await uploadMedia(part);
        uri = uploaded.uri;
        updates.push({ index, fileUri: uploaded.uri, fileExpiresAt: uploaded.expiresAt });
      }

      if (part.mediaType === "image") {
        input.push(
          uri
            ? { type: "image", mime_type: part.mimeType, uri, resolution: "high" }
            : { type: "image", mime_type: part.mimeType, data: part.data, resolution: "high" },
        );
      } else {
        input.push(
          uri
            ? { type: "document", mime_type: part.mimeType, uri }
            : { type: "document", mime_type: part.mimeType, data: part.data },
        );
      }
      if (!uri) inlineBytes += part.size;
    }
  } catch (error) {
    throw toAppError(error, "Files API");
  }

  return { input, updates };
}
