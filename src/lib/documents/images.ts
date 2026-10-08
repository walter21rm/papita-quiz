import sharp from "sharp";

export interface NormalizedImage {
  mimeType: string;
  data: Buffer;
  page?: number;
}

const NATIVE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);
const MAX_SIDE_CONVERTED = 2048;
const MAX_SIDE_LARGE_NATIVE = 3072;
const MAX_NATIVE_BYTES = 7 * 1024 * 1024;
const MAX_PAGES = 30;

export async function normalizeImage(buffer: Buffer, mime: string): Promise<NormalizedImage[]> {
  if (mime === "image/heic" || mime === "image/heif") {
    return [{ mimeType: mime, data: buffer }];
  }

  if (NATIVE_MIME.has(mime)) {
    const metadata = await sharp(buffer).metadata().catch(() => null);
    if (!metadata?.width || !metadata.height) throw new Error("unreadable image");
    const rotated = metadata.orientation !== undefined && metadata.orientation !== 1;
    if (!rotated && buffer.length <= MAX_NATIVE_BYTES) {
      return [{ mimeType: mime, data: buffer }];
    }
    const pipeline = sharp(buffer)
      .rotate()
      .resize({ width: MAX_SIDE_LARGE_NATIVE, height: MAX_SIDE_LARGE_NATIVE, fit: "inside", withoutEnlargement: true });
    const data =
      mime === "image/jpeg" ? await pipeline.jpeg({ quality: 90 }).toBuffer() : await pipeline.png().toBuffer();
    return [{ mimeType: mime === "image/jpeg" ? "image/jpeg" : "image/png", data }];
  }

  return convertToPng(buffer, mime);
}

async function convertToPng(buffer: Buffer, mime: string): Promise<NormalizedImage[]> {
  const isSvg = mime === "image/svg+xml";
  const isAnimated = mime === "image/gif" || mime === "image/webp";
  try {
    const metadata = await sharp(buffer, isSvg ? { density: 192 } : {}).metadata();
    const pages = isAnimated ? 1 : Math.min(metadata.pages ?? 1, MAX_PAGES);
    const results: NormalizedImage[] = [];
    for (let page = 0; page < pages; page++) {
      const data = await sharp(buffer, isSvg ? { density: 192 } : { page })
        .rotate()
        .resize({ width: MAX_SIDE_CONVERTED, height: MAX_SIDE_CONVERTED, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      results.push({ mimeType: "image/png", data, page: pages > 1 ? page + 1 : undefined });
    }
    return results;
  } catch {
    const { Jimp } = await import("jimp");
    const image = await Jimp.fromBuffer(buffer);
    if (image.bitmap.width > MAX_SIDE_CONVERTED || image.bitmap.height > MAX_SIDE_CONVERTED) {
      image.scaleToFit({ w: MAX_SIDE_CONVERTED, h: MAX_SIDE_CONVERTED });
    }
    const data = await image.getBuffer("image/png");
    return [{ mimeType: "image/png", data }];
  }
}
