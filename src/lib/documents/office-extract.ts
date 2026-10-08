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

export async function extractLegacyWord(buffer: Buffer): Promise<string> {
  const { default: WordExtractor } = await import("word-extractor");
  const document = await new WordExtractor().extract(buffer);
  return [document.getBody(), document.getTextboxes(), document.getFootnotes(), document.getEndnotes()]
    .map((section) => section?.trim())
    .filter(Boolean)
    .join("\n\n");
}
