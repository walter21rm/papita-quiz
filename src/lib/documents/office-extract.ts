import type { OfficeAttachment, SupportedFileType } from "officeparser";

type ChartData = NonNullable<OfficeAttachment["chartData"]>;

export interface ExtractedImage {
  name: string;
  mimeType: string;
  data: Buffer;
  altText?: string;
}

export interface ExtractedContent {
  text: string;
  images: ExtractedImage[];
}

function describeChart(name: string, chart: ChartData): string {
  const lines = [`Gráfico ${chart.title ? `"${chart.title}"` : `(${name})`}:`];
  if (chart.xAxisTitle) lines.push(`- Eje X: ${chart.xAxisTitle}`);
  if (chart.yAxisTitle) lines.push(`- Eje Y: ${chart.yAxisTitle}`);
  if (chart.labels.length) lines.push(`- Categorías: ${chart.labels.join(", ")}`);
  for (const dataSet of chart.dataSets) {
    lines.push(`- Serie ${dataSet.name ? `"${dataSet.name}"` : ""}: ${dataSet.values.join(", ")}`);
  }
  return lines.join("\n");
}

// officeparser always writes YAML frontmatter (author, dates); keep only sheet/section titles.
function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/^---\r?\n((?:[A-Za-z_][\w-]*:.*\r?\n)+)---\r?\n?/gm, (_block, body: string) => {
      const title = /^title:\s*"?(.*?)"?\s*$/m.exec(body)?.[1];
      return title ? `## ${title}\n` : "";
    })
    .replace(/(?:^---[ \t]*\r?\n(?:[ \t]*\r?\n)*){2,}/gm, "---\n\n")
    .replace(/^\s*---[ \t]*\r?\n/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractWithOfficeParser(buffer: Buffer, fileType: SupportedFileType): Promise<ExtractedContent> {
  const { OfficeParser } = await import("officeparser");
  const ast = await OfficeParser.parseOffice(buffer, {
    fileType,
    extractAttachments: true,
    ocr: false,
    ignoreComments: true,
    ignoreSlideMasters: true,
  });

  const markdown = await ast.to("md", { includeImages: "image-only", maxInlineImageBytes: 1, ignoreInternalLinks: true });
  const sections = [typeof markdown.value === "string" ? cleanMarkdown(markdown.value) : ""];
  const images: ExtractedImage[] = [];

  for (const attachment of ast.attachments ?? []) {
    if (attachment.type === "chart") {
      if (attachment.chartData) sections.push(describeChart(attachment.name, attachment.chartData));
      continue;
    }
    if (!attachment.data) continue;
    images.push({
      name: attachment.name,
      mimeType: attachment.mimeType,
      data: Buffer.from(attachment.data, "base64"),
      altText: attachment.altText,
    });
  }

  return { text: sections.filter(Boolean).join("\n\n"), images };
}

const TEXT_CHARS_ATOM = 0x0fa0;
const TEXT_BYTES_ATOM = 0x0fa8;
const SLIDE_MASTER_LINE =
  /^(haga clic para (modificar|agregar)|click to (edit|add)|segundo nivel|tercer nivel|cuarto nivel|quinto nivel|second level|third level|fourth level|fifth level)\b/i;

function slideTextFromRecords(buffer: Buffer): string {
  const pieces: string[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset + 8 < buffer.length; offset++) {
    const header = buffer.readUInt16LE(offset);
    if ((header & 0x000f) !== 0 || header >> 4 !== 0) continue;
    const type = buffer.readUInt16LE(offset + 2);
    if (type !== TEXT_CHARS_ATOM && type !== TEXT_BYTES_ATOM) continue;
    const length = buffer.readUInt32LE(offset + 4);
    if (length < 2 || length > 16_000 || offset + 8 + length > buffer.length) continue;
    if (type === TEXT_CHARS_ATOM && length % 2 !== 0) continue;
    const raw = buffer.subarray(offset + 8, offset + 8 + length);
    const rawText = (type === TEXT_CHARS_ATOM ? raw.toString("utf16le") : raw.toString("latin1"))
      .replace(/\u0000/g, "")
      .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const text = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !SLIDE_MASTER_LINE.test(line))
      .join("\n");
    const letters = text.replace(/[^\p{L}\p{N}]/gu, "");
    if (letters.length < 2 || letters.length / Math.max(text.length, 1) < 0.35) continue;
    const key = letters.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pieces.push(text);
    offset += 7 + length;
  }
  return pieces.join("\n\n");
}

function embeddedImages(buffer: Buffer): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const push = (data: Buffer, mimeType: string) => {
    if (data.length < 8_000 || data.length > 4_000_000 || images.length >= 12) return;
    images.push({ name: `imagen-${images.length + 1}`, mimeType, data });
  };
  let cursor = 0;
  while (cursor < buffer.length && images.length < 24) {
    const jpeg = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]), cursor);
    if (jpeg < 0) break;
    const marker = buffer[jpeg + 3];
    if (marker !== 0xe0 && marker !== 0xe1 && marker !== 0xdb && marker !== 0xee && marker !== 0xe2) {
      cursor = jpeg + 3;
      continue;
    }
    const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), jpeg + 4);
    if (end > jpeg) push(buffer.subarray(jpeg, end + 2), "image/jpeg");
    cursor = jpeg + 3;
  }
  cursor = 0;
  const pngStart = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngEnd = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  while (cursor < buffer.length && images.length < 24) {
    const png = buffer.indexOf(pngStart, cursor);
    if (png < 0) break;
    const end = buffer.indexOf(pngEnd, png + pngStart.length);
    if (end > png) push(buffer.subarray(png, end + pngEnd.length), "image/png");
    cursor = png + pngStart.length;
  }
  return images;
}

function streamBuffer(content: Uint8Array | number[] | undefined): Buffer | null {
  if (!content || content.length === 0) return null;
  return Buffer.from(content);
}

async function realImages(candidates: ExtractedImage[]): Promise<ExtractedImage[]> {
  const { default: sharp } = await import("sharp");
  const kept: ExtractedImage[] = [];
  for (const image of candidates) {
    try {
      const data = await sharp(image.data, { failOn: "error" })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      const meta = await sharp(data).metadata();
      if (!meta.width || !meta.height || meta.width < 80 || meta.height < 80) continue;
      kept.push({ name: `imagen-${kept.length + 1}`, mimeType: "image/jpeg", data });
    } catch {
      // Byte sequences that merely look like a photo are ignored.
    }
    if (kept.length >= 8) break;
  }
  return kept;
}

/** Reads a PowerPoint 97–2003 file (.ppt) without Microsoft Office. */
export async function extractLegacyPowerPoint(buffer: Buffer): Promise<ExtractedContent> {
  let document = buffer;
  const imageSources: Buffer[] = [];
  try {
    const { find, parse } = await import("cfb");
    const container = parse(buffer, { type: "buffer" });
    for (const name of ["PowerPoint Document", "/PowerPoint Document", "Pictures", "/Pictures"]) {
      const entry = find(container, name);
      const content = streamBuffer(entry?.content);
      if (!content) continue;
      if (name.includes("PowerPoint Document")) document = content;
      else imageSources.push(content);
    }
  } catch {
    imageSources.push(buffer);
  }
  if (imageSources.length === 0) imageSources.push(document);
  const candidates: ExtractedImage[] = [];
  const seenSizes = new Set<number>();
  for (const source of imageSources) {
    for (const image of embeddedImages(source)) {
      if (seenSizes.has(image.data.length)) continue;
      seenSizes.add(image.data.length);
      candidates.push(image);
    }
  }
  return { text: slideTextFromRecords(document), images: await realImages(candidates) };
}

export async function extractLegacyWord(buffer: Buffer): Promise<string> {
  const { default: WordExtractor } = await import("word-extractor");
  const document = await new WordExtractor().extract(buffer);
  return [document.getBody(), document.getTextboxes(), document.getFootnotes(), document.getEndnotes()]
    .map((section) => section?.trim())
    .filter(Boolean)
    .join("\n\n");
}
