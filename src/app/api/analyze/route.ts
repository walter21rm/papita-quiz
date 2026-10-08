import { z } from "zod";
import { normalizeAnalysis } from "@/lib/analysis";
import { processFiles } from "@/lib/documents";
import { AppError, errorResponse } from "@/lib/errors";
import { assertApiKey, corpusToInput, generateJson, MODELS, resolveGeminiFile } from "@/lib/gemini";
import { formatBytes, LIMITS, mimeForFile } from "@/lib/labels";
import { ANALYSIS_SYSTEM, buildAnalysisPrompt } from "@/lib/prompts";
import { analysisJsonSchema } from "@/lib/schemas";
import type { CorpusPart } from "@/lib/types";

export const maxDuration = 300;

const remoteFileSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  geminiName: z.string().regex(/^files\/[A-Za-z0-9_-]+$/),
});

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
      const parsed = z.object({ remotes: z.array(remoteFileSchema).min(1).max(LIMITS.maxFiles) }).safeParse(body);
      if (!parsed.success) throw new AppError("bad_request", "La solicitud para analizar no es válida.");
      const parts: CorpusPart[] = [];
      for (const file of parsed.data.remotes) {
        const ready = await resolveGeminiFile(file.geminiName);
        parts.push({
          kind: "media",
          label: `"${file.name}"`,
          mediaType: (ready.mimeType || file.mimeType).startsWith("image/") ? "image" : "document",
          mimeType: mimeForFile(file.name, ready.mimeType || file.mimeType),
          size: file.size,
          data: "",
          fileUri: ready.fileUri,
          fileExpiresAt: ready.fileExpiresAt,
        });
      }
      return Response.json(await analyzeParts(parts, [], parsed.data.remotes.map((file) => file.name)));
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
