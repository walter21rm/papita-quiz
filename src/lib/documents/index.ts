import type { SupportedFileType } from "officeparser";
import type { CorpusPart, MediaPart, TextPart } from "@/lib/types";
import { detectFile, sniffMime, type DocumentKind } from "./detect";
import { normalizeImage, type NormalizedImage } from "./images";
import { convertWithOffice } from "./office-convert";
import { extractLegacyWord, extractWithOfficeParser, type ExtractedContent } from "./office-extract";

export interface IncomingFile {
  name: string;
  type: string;
  buffer: Buffer;
}

export interface ProcessedFiles {
  parts: CorpusPart[];
  notes: string[];
}

interface FileResult {
  parts: CorpusPart[];
  notes: string[];
}

const MAX_TEXT_CHARS = 600_000;
const MAX_EMBEDDED_IMAGES = 40;
const MIN_EMBEDDED_IMAGE_BYTES = 3 * 1024;

const PARSER_TYPE: Record<string, SupportedFileType> = {
  docx: "docx",
  docm: "docx",
  dotx: "docx",
  pptx: "pptx",
  pptm: "pptx",
  ppsx: "pptx",
  potx: "pptx",
  xlsx: "xlsx",
  xlsm: "xlsx",
  odt: "odt",
  ott: "odt",
  odp: "odp",
  otp: "odp",
  ods: "ods",
  ots: "ods",
  rtf: "rtf",
  csv: "csv",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  epub: "epub",
  tex: "tex",
};

function textPart(label: string, text: string, notes: string[], fileName: string): TextPart {
  let content = text.trim();
  if (content.length > MAX_TEXT_CHARS) {
    content = content.slice(0, MAX_TEXT_CHARS);
    notes.push(`"${fileName}" es muy largo; usé solo la primera parte del texto.`);
  }
  return { kind: "text", label, text: content };
}

function mediaPart(label: string, mediaType: MediaPart["mediaType"], mimeType: string, data: Buffer): MediaPart {
  return { kind: "media", label, mediaType, mimeType, size: data.length, data: data.toString("base64") };
}

function imageParts(label: string, images: NormalizedImage[]): MediaPart[] {
  return images.map((image) =>
    mediaPart(image.page ? `${label}, página ${image.page}` : label, "image", image.mimeType, image.data),
  );
}

function decodeText(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder("utf-16be").decode(buffer.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function fromExtraction(fileName: string, extracted: ExtractedContent): Promise<FileResult> {
  const notes: string[] = [];
  const parts: CorpusPart[] = [];
  if (extracted.text.trim()) {
    parts.push(textPart(`Contenido de "${fileName}"`, extracted.text, notes, fileName));
  }

  let added = 0;
  let skipped = 0;
  for (const image of extracted.images) {
    if (image.data.length < MIN_EMBEDDED_IMAGE_BYTES) continue;
    if (added >= MAX_EMBEDDED_IMAGES) {
      skipped++;
      continue;
    }
    const mime = sniffMime(image.data) ?? image.mimeType;
    try {
      const [normalized] = await normalizeImage(image.data, mime);
      if (!normalized) continue;
      const description = image.altText ? ` (${image.altText})` : "";
      parts.push(...imageParts(`Imagen "${image.name}" dentro de "${fileName}"${description}`, [normalized]));
      added++;
    } catch {
      // Vector formats such as EMF/WMF cannot be rasterized here; the surrounding text still covers them.
    }
  }
  if (skipped > 0) notes.push(`"${fileName}" tiene muchas imágenes; analicé las primeras ${MAX_EMBEDDED_IMAGES}.`);
  if (parts.length === 0) notes.push(`"${fileName}" no tiene texto ni imágenes que pueda leer.`);
  return { parts, notes };
}

async function processOfficeDocument(file: IncomingFile, extension: string, kind: DocumentKind): Promise<FileResult> {
  const app = kind === "word" ? "word" : "powerpoint";
  const pdf = await convertWithOffice(file.buffer, extension, app, "pdf");
  if (pdf) {
    return {
      parts: [mediaPart(`"${file.name}" (convertido a PDF con Office)`, "document", "application/pdf", pdf)],
      notes: [],
    };
  }

  const parserType = PARSER_TYPE[extension];
  if (parserType) return fromExtraction(file.name, await extractWithOfficeParser(file.buffer, parserType));

  if (extension === "doc" || extension === "dot") {
    const notes: string[] = [];
    const text = await extractLegacyWord(file.buffer);
    if (!text) return { parts: [], notes: [`"${file.name}" parece estar vacío.`] };
    return { parts: [textPart(`Contenido de "${file.name}"`, text, notes, file.name)], notes };
  }

  const suggestion = kind === "word" ? ".docx" : ".pptx";
  return {
    parts: [],
    notes: [`No pude abrir "${file.name}". Guárdalo como ${suggestion} o PDF y vuelve a subirlo.`],
  };
}

async function processSpreadsheet(file: IncomingFile, extension: string): Promise<FileResult> {
  if (extension === "tsv") {
    const notes: string[] = [];
    return { parts: [textPart(`Tabla "${file.name}"`, decodeText(file.buffer), notes, file.name)], notes };
  }
  if (extension === "xls") {
    const xlsx = await convertWithOffice(file.buffer, extension, "excel", "xlsx");
    if (!xlsx) {
      return { parts: [], notes: [`No pude abrir "${file.name}". Guárdalo como .xlsx y vuelve a subirlo.`] };
    }
    return fromExtraction(file.name, await extractWithOfficeParser(xlsx, "xlsx"));
  }
  return fromExtraction(file.name, await extractWithOfficeParser(file.buffer, PARSER_TYPE[extension] ?? "xlsx"));
}

async function processFile(file: IncomingFile): Promise<FileResult> {
  const detected = detectFile(file.name, file.type, file.buffer);
  const notes: string[] = [];

  switch (detected.kind) {
    case "pdf":
      return { parts: [mediaPart(`PDF "${file.name}"`, "document", "application/pdf", file.buffer)], notes };
    case "image":
      return { parts: imageParts(`Imagen "${file.name}"`, await normalizeImage(file.buffer, detected.mime)), notes };
    case "word":
    case "presentation":
      return processOfficeDocument(file, detected.extension, detected.kind);
    case "spreadsheet":
      return processSpreadsheet(file, detected.extension);
    case "structured":
      if (detected.extension === "md" || detected.extension === "markdown") {
        return { parts: [textPart(`Contenido de "${file.name}"`, decodeText(file.buffer), notes, file.name)], notes };
      }
      return fromExtraction(file.name, await extractWithOfficeParser(file.buffer, PARSER_TYPE[detected.extension]));
    case "text":
      return { parts: [textPart(`Contenido de "${file.name}"`, decodeText(file.buffer), notes, file.name)], notes };
    default:
      return { parts: [], notes: [`"${file.name}" tiene un formato que todavía no sé leer.`] };
  }
}

export async function processFiles(files: IncomingFile[]): Promise<ProcessedFiles> {
  const parts: CorpusPart[] = [];
  const notes: string[] = [];
  for (const file of files) {
    try {
      const result = await processFile(file);
      parts.push(...result.parts);
      notes.push(...result.notes);
    } catch (error) {
      console.warn(`[papita-quiz] No se pudo procesar ${file.name}:`, error);
      notes.push(`No pude leer "${file.name}". Puede estar dañado o protegido con contraseña.`);
    }
  }
  return { parts, notes };
}
