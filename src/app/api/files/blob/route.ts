import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { LIMITS } from "@/lib/labels";

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        maximumSizeInBytes: LIMITS.maxFileBytes,
        addRandomSuffix: true,
      }),
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude preparar la subida.";
    return Response.json({ error: message }, { status: 400 });
  }
}
