import { AppError, errorResponse } from "@/lib/errors";
import { assertApiKey, pushResumableChunk } from "@/lib/gemini";
import { LIMITS } from "@/lib/labels";
import { decodeUploadHandle } from "@/lib/upload-session";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertApiKey();
    const form = await request.formData().catch(() => null);
    if (!form) throw new AppError("bad_request", "No recibí este tramo del archivo.");
    const handle = String(form.get("handle") ?? "");
    const offset = Number(form.get("offset"));
    const last = String(form.get("last") ?? "") === "1";
    const chunk = form.get("chunk");
    if (!handle || !Number.isFinite(offset) || offset < 0 || !(chunk instanceof File) || chunk.size === 0) {
      throw new AppError("bad_request", "Este tramo de la subida no es válido.");
    }
    if (chunk.size > LIMITS.gatewayBytes) {
      throw new AppError("bad_request", "Un tramo de la subida salió demasiado grande. Vuelve a intentarlo.");
    }
    const file = await pushResumableChunk({
      uploadUrl: decodeUploadHandle(handle),
      chunk: Buffer.from(await chunk.arrayBuffer()),
      offset,
      last,
    });
    return Response.json(file ? { file } : { ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
