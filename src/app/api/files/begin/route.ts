import { AppError, errorResponse } from "@/lib/errors";
import { beginResumableUpload } from "@/lib/gemini";
import { LIMITS, mimeForFile } from "@/lib/labels";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      filename?: unknown;
      mimeType?: unknown;
      size?: unknown;
    } | null;
    const filename = typeof body?.filename === "string" ? body.filename.trim() : "";
    const size = typeof body?.size === "number" ? body.size : Number(body?.size);
    if (!filename || !Number.isFinite(size) || size <= 0) {
      throw new AppError("bad_request", "No pude preparar la subida de ese archivo.");
    }
    if (size > LIMITS.maxFileBytes) {
      throw new AppError("bad_request", "Ese archivo pesa más de lo que puedo analizar.");
    }
    const mimeType =
      typeof body?.mimeType === "string" && body.mimeType ? body.mimeType : mimeForFile(filename);
    const uploadUrl = await beginResumableUpload({ filename, mimeType, size });
    return Response.json({ uploadUrl, mimeType });
  } catch (error) {
    return errorResponse(error);
  }
}
