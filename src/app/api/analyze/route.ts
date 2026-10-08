import { del, get } from "@vercel/blob";
import { z } from "zod";
import { normalizeAnalysis } from "@/lib/analysis";
import { processFiles } from "@/lib/documents";
import { AppError, errorResponse } from "@/lib/errors";
import { assertApiKey, corpusToInput, generateJson, MODELS } from "@/lib/gemini";
import { formatBytes, LIMITS } from "@/lib/labels";
import { ANALYSIS_SYSTEM, buildAnalysisPrompt } from "@/lib/prompts";
import { analysisJsonSchema } from "@/lib/schemas";
import type { CorpusPart } from "@/lib/types";

export const maxDuration = 300;

const blobFileSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive().max(LIMITS.maxFileBytes),
});

function assertBlobUrl(url: string) {
  const host = new URL(url).hostname;
  if (!host.endsWith(".blob.vercel-storage.com")) {
    throw new AppError("bad_request", "La subida del archivo no es válida. Vuelve a intentarlo.");
  }
}

function fallbackTitle(names: string[]): string {
  const first = names[0]?.replace(/\.[^.]+$/, "") ?? "Mi material";
  return names.length > 1 ? `${first} y ${names.length - 1} más` : first;
}

function clientCorpus(parts: CorpusPart[]): CorpusPart[] {
  return parts.map((part) => (part.kind === "media" && part.fileUri ? { ...part, data: "" } : part));
}

async function analyzeParts(parts: CorpusPart[], notes: string[], names: string[]) {
  if (parts.length === 0) throw new AppError("unreadable_files", "No pude leer ninguno de tus archivos.", notes);
  const { input, updates } = await corpusToInput(parts);
  for (const update of updates) {
    const part = parts[update.index];
    if (part.kind === "media") {
      part.fileUri = update.fileUri;
      part.fileExpiresAt = update.fileExpiresAt;
    }
  }
  const raw = await generateJson({
    models: MODELS.main,
    system: ANALYSIS_SYSTEM,
    input: [...input, { type: "text", text: buildAnalysisPrompt(parts.length) }],
    schema: analysisJsonSchema,
    thinking: "high",
  });
  return {
    analysis: normalizeAnalysis(raw, fallbackTitle(names)),
    corpus: clientCorpus(parts),
    notes,
  };
}

export async function POST(request: Request) {
  try {
    assertApiKey();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      const parsed = z.object({ blobs: z.array(blobFileSchema).min(1).max(LIMITS.maxFiles) }).safeParse(body);
      if (!parsed.success) throw new AppError("bad_request", "La solicitud para analizar no es válida.");
      const incoming = [];
      for (const file of parsed.data.blobs) {
        assertBlobUrl(file.url);
        try {
          const downloaded = await get(file.url, { access: "private" });
          if (!downloaded || downloaded.statusCode !== 200) {
            throw new AppError("bad_request", `No encontré "${file.name}". Vuelve a subirlo.`);
          }
          incoming.push({
            name: file.name,
            type: file.mimeType,
            buffer: Buffer.from(await new Response(downloaded.stream).arrayBuffer()),
          });
        } finally {
          await del(file.url).catch(() => undefined);
        }
      }
      const { parts, notes } = await processFiles(incoming);
      return Response.json(
        await analyzeParts(parts, notes, parsed.data.blobs.map((file) => file.name)),
      );
    }

    const form = await request.formData().catch(() => {
      throw new AppError("bad_request", "No recibí ningún archivo.");
    });
    const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length === 0) throw new AppError("bad_request", "No recibí ningún archivo.");
    if (files.length > LIMITS.maxFiles) {
      throw new AppError("bad_request", `Puedes subir hasta ${LIMITS.maxFiles} archivos a la vez.`);
    }
    const tooBig = files.find((file) => file.size > LIMITS.maxFileBytes);
    if (tooBig) {
      throw new AppError(
        "bad_request",
        `"${tooBig.name}" pesa ${formatBytes(tooBig.size)}; el máximo por archivo es ${formatBytes(LIMITS.maxFileBytes)}.`,
      );
    }
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > LIMITS.maxTotalBytes) {
      throw new AppError("bad_request", `En total puedes subir hasta ${formatBytes(LIMITS.maxTotalBytes)}.`);
    }

    const incoming = await Promise.all(
      files.map(async (file) => ({ name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) })),
    );
    const { parts, notes } = await processFiles(incoming);
    return Response.json(await analyzeParts(parts, notes, files.map((file) => file.name)));
  } catch (error) {
    return errorResponse(error);
  }
}
