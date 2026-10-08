import { normalizeAnalysis } from "@/lib/analysis";
import { processFiles } from "@/lib/documents";
import { AppError, errorResponse } from "@/lib/errors";
import { assertApiKey, corpusToInput, generateJson, MODELS } from "@/lib/gemini";
import { formatBytes, LIMITS } from "@/lib/labels";
import { ANALYSIS_SYSTEM, buildAnalysisPrompt } from "@/lib/prompts";
import { analysisJsonSchema } from "@/lib/schemas";

export const maxDuration = 300;

function fallbackTitle(files: File[]): string {
  const first = files[0]?.name.replace(/\.[^.]+$/, "") ?? "Mi material";
  return files.length > 1 ? `${first} y ${files.length - 1} más` : first;
}

export async function POST(request: Request) {
  try {
    assertApiKey();
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
      model: MODELS.main,
      system: ANALYSIS_SYSTEM,
      input: [...input, { type: "text", text: buildAnalysisPrompt(parts.length) }],
      schema: analysisJsonSchema,
      thinking: "high",
    });
    const analysis = normalizeAnalysis(raw, fallbackTitle(files));

    return Response.json({ analysis, corpus: parts, notes });
  } catch (error) {
    return errorResponse(error);
  }
}
