import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AppError } from "./errors";
import type { CorpusPart, FileUpdate, MediaPart } from "./types";

function modelList(primary: string | undefined, fallbacks: string | undefined, defaults: string[]): string[] {
  const configured = [primary, ...(fallbacks ?? defaults.join(",")).split(",")]
    .map((model) => model?.trim())
    .filter((model): model is string => Boolean(model));
  return [...new Set(configured.length ? configured : defaults)];
}

// Each free-tier model has its own daily quota, so falling back to the next one keeps the app usable.
export const MODELS = {
  main: modelList(process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODELS, [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
  ]),
  fast: modelList(process.env.GEMINI_FAST_MODEL, process.env.GEMINI_FAST_FALLBACK_MODELS, [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
  ]),
};

const INLINE_PART_LIMIT = 15 * 1024 * 1024;
const INLINE_TOTAL_LIMIT = 20 * 1024 * 1024;
const FILE_URI_SAFETY_MARGIN_MS = 30 * 60 * 1000;
const FILE_DEFAULT_LIFETIME_MS = 47 * 60 * 60 * 1000;
const SHORT_RATE_LIMIT_MS = 20_000;
const OVERLOAD_COOLDOWN_MS = 60_000;
const DEFAULT_QUOTA_COOLDOWN_MS = 60 * 60 * 1000;
const REQUEST_OPTIONS = { maxRetries: 0, retries: { strategy: "none" as const } };

type ThinkingLevel = "low" | "medium" | "high";

export type InputContent =
  | { type: "text"; text: string }
  | { type: "image"; mime_type: string; data?: string; uri?: string; resolution?: "low" | "medium" | "high" }
  | { type: "document"; mime_type: string; data?: string; uri?: string };

let client: GoogleGenAI | null = null;
const unavailableUntil = new Map<string, number>();

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

function errorText(error: unknown): string {
  if (typeof error !== "object" || error === null) return String(error);
  const candidate = error as { message?: unknown; body?: unknown };
  return `${String(candidate.message ?? "")} ${typeof candidate.body === "string" ? candidate.body : ""}`;
}

function retryDelayMs(error: unknown): number | undefined {
  const text = errorText(error);
  const human = /retry in\s+((?:\d+h)?\s*(?:\d+m)?\s*(?:[\d.]+s)?)/i.exec(text)?.[1];
  if (human) {
    const hours = Number(/(\d+)h/.exec(human)?.[1] ?? 0);
    const minutes = Number(/(\d+)m/.exec(human)?.[1] ?? 0);
    const seconds = Number(/([\d.]+)s/.exec(human)?.[1] ?? 0);
    const total = ((hours * 60 + minutes) * 60 + seconds) * 1000;
    if (total > 0) return total;
  }
  const field = /"retryDelay"\s*:\s*"([\d.]+)s"/.exec(text)?.[1];
  return field ? Number(field) * 1000 : undefined;
}

type FailureKind = "quota" | "overloaded" | "missing_model" | "bad_output" | "fatal";

function classify(error: unknown): FailureKind {
  if (error instanceof AppError) return error.code === "ai_bad_response" ? "bad_output" : "fatal";
  const status = errorStatus(error);
  const text = errorText(error).toLowerCase();
  if (status === 429 || text.includes("resource_exhausted")) return "quota";
  if (status === 404 || (text.includes("model") && text.includes("not found"))) return "missing_model";
  if (status === undefined || status >= 500) return "overloaded";
  return "fatal";
}

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.ceil(minutes / 60)} h`;
}

function toAppError(error: unknown): AppError {
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
  if (status === 400 || status === 413) {
    return new AppError("bad_request", `Gemini no pudo procesar el material: ${message}`);
  }
  console.error("[papita-quiz] Error de Gemini:", error);
  return new AppError("ai_unavailable", "No pude comunicarme con Gemini. Revisa tu conexión a internet.");
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

interface GenerateOptions {
  models: string[];
  system: string;
  input: InputContent[];
  schema: Record<string, unknown>;
  thinking: ThinkingLevel;
}

async function callModel(model: string, options: GenerateOptions, withThinking = true, retried = false): Promise<unknown> {
  try {
    const interaction = await getClient().interactions.create(
      {
        model,
        system_instruction: options.system,
        input: options.input,
        response_format: { type: "text", mime_type: "application/json", schema: options.schema },
        ...(withThinking ? { generation_config: { thinking_level: options.thinking } } : {}),
      },
      REQUEST_OPTIONS,
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
    if (withThinking && errorStatus(error) === 400 && /thinking/i.test(errorText(error))) {
      return callModel(model, options, false, retried);
    }
    const delay = retryDelayMs(error);
    if (!retried && classify(error) === "quota" && delay !== undefined && delay <= SHORT_RATE_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay + 500));
      return callModel(model, options, withThinking, true);
    }
    throw error;
  }
}

/** Calls the first available model of the chain and returns the parsed JSON answer. */
export async function generateJson(options: GenerateOptions): Promise<unknown> {
  assertApiKey();
  const now = Date.now();
  const available = options.models.filter((model) => (unavailableUntil.get(model) ?? 0) <= now);
  if (available.length === 0) {
    const soonest = Math.min(...options.models.map((model) => unavailableUntil.get(model) ?? now));
    throw new AppError(
      "rate_limited",
      `Se acabó por ahora tu cuota gratuita de Gemini. Vuelve a intentarlo en unos ${formatWait(soonest - now)}; mientras tanto puedes repasar tus quizzes ya creados.`,
    );
  }

  let lastQuotaWait: number | undefined;
  let lastError: unknown;
  for (const model of available) {
    try {
      return await callModel(model, options);
    } catch (error) {
      lastError = error;
      const kind = classify(error);
      if (kind === "fatal") throw toAppError(error);
      if (kind === "quota") {
        lastQuotaWait = retryDelayMs(error) ?? DEFAULT_QUOTA_COOLDOWN_MS;
        unavailableUntil.set(model, Date.now() + lastQuotaWait);
      } else if (kind === "overloaded") {
        unavailableUntil.set(model, Date.now() + OVERLOAD_COOLDOWN_MS);
      } else if (kind === "missing_model") {
        unavailableUntil.set(model, Date.now() + 24 * 60 * 60 * 1000);
      }
      console.warn(`[papita-quiz] ${model} no respondió (${kind}); probando con el siguiente modelo.`);
    }
  }

  if (lastQuotaWait !== undefined) {
    throw new AppError(
      "rate_limited",
      `Llegaste al límite gratuito de Gemini por ahora. Vuelve a intentarlo en unos ${formatWait(lastQuotaWait)}; mientras tanto puedes repasar tus quizzes ya creados.`,
    );
  }
  if (lastError instanceof AppError) throw lastError;
  throw new AppError("ai_unavailable", "Gemini está muy ocupado en este momento. Vuelve a intentarlo en un minuto.");
}

export interface UploadedGeminiFile {
  fileUri: string;
  fileExpiresAt: number;
  mimeType: string;
  size: number;
}

function fileExpiresAt(expirationTime?: string): number {
  return expirationTime ? Date.parse(expirationTime) : Date.now() + FILE_DEFAULT_LIFETIME_MS;
}

async function waitUntilActive(name: string): Promise<{ uri: string; mimeType: string; size: number; expiresAt: number }> {
  const ai = getClient();
  let file = await ai.files.get({ name });
  const deadline = Date.now() + 120_000;
  while (file.state === "PROCESSING" && file.name && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await ai.files.get({ name: file.name });
  }
  if (!file.uri || file.state === "FAILED") {
    throw new AppError("ai_unavailable", "Gemini no pudo recibir el archivo. Vuelve a intentarlo.");
  }
  return {
    uri: file.uri,
    mimeType: file.mimeType ?? "application/octet-stream",
    size: Number(file.sizeBytes ?? 0),
    expiresAt: fileExpiresAt(file.expirationTime),
  };
}

async function uploadMedia(part: MediaPart): Promise<{ uri: string; expiresAt: number }> {
  if (!part.data) {
    throw new AppError(
      "bad_request",
      `El archivo ${part.label} ya no está disponible. Vuelve a subirlo para crear un quiz nuevo.`,
    );
  }
  const ai = getClient();
  const blob = new Blob([Buffer.from(part.data, "base64")], { type: part.mimeType });
  const uploaded = await ai.files.upload({
    file: blob,
    config: { mimeType: part.mimeType, displayName: part.label.slice(0, 500) },
  });
  if (!uploaded.name) {
    throw new AppError("ai_unavailable", `Gemini no pudo recibir el archivo ${part.label}. Vuelve a intentarlo.`);
  }
  const ready = await waitUntilActive(uploaded.name);
  return { uri: ready.uri, expiresAt: ready.expiresAt };
}

/** Opens a Gemini resumable session so the browser can send a large file in parts under Vercel's body limit. */
export async function beginResumableUpload(options: {
  filename: string;
  mimeType: string;
  size: number;
}): Promise<string> {
  const apiKey = assertApiKey();
  const response = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(options.size),
      "X-Goog-Upload-Header-Content-Type": options.mimeType,
      "X-Goog-Upload-File-Name": options.filename.slice(0, 500),
    },
    body: JSON.stringify({ file: { display_name: options.filename.slice(0, 500) } }),
  });
  const uploadUrl = response.headers.get("x-goog-upload-url");
  if (!response.ok || !uploadUrl) {
    const detail = await response.text().catch(() => "");
    throw toAppError(new Error(detail || `No pude iniciar la subida (${response.status}).`));
  }
  return uploadUrl;
}

export async function pushResumableChunk(options: {
  uploadUrl: string;
  chunk: Buffer;
  offset: number;
  last: boolean;
}): Promise<UploadedGeminiFile | null> {
  const response = await fetch(options.uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": options.last ? "upload, finalize" : "upload",
      "X-Goog-Upload-Offset": String(options.offset),
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(options.chunk),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw toAppError(new Error(detail || `Falló un tramo de la subida (${response.status}).`));
  }
  if (!options.last) return null;
  const body = (await response.json().catch(() => null)) as { file?: { name?: string; uri?: string; mimeType?: string; sizeBytes?: string; expirationTime?: string } } | null;
  const name = body?.file?.name;
  if (name) {
    const ready = await waitUntilActive(name);
    return { fileUri: ready.uri, fileExpiresAt: ready.expiresAt, mimeType: ready.mimeType, size: ready.size };
  }
  if (body?.file?.uri) {
    return {
      fileUri: body.file.uri,
      fileExpiresAt: fileExpiresAt(body.file.expirationTime),
      mimeType: body.file.mimeType ?? "application/octet-stream",
      size: Number(body.file.sizeBytes ?? options.offset + options.chunk.length),
    };
  }
  throw new AppError("ai_unavailable", "Gemini no confirmó la subida del archivo. Vuelve a intentarlo.");
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
      if (!uri && (part.size > INLINE_PART_LIMIT || inlineBytes + part.size > INLINE_TOTAL_LIMIT || !part.data)) {
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
    throw toAppError(error);
  }

  return { input, updates };
}
