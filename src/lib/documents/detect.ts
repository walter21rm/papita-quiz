export type DocumentKind =
  | "pdf"
  | "image"
  | "word"
  | "presentation"
  | "spreadsheet"
  | "structured"
  | "text"
  | "unsupported";

const KIND_BY_EXTENSION: Record<string, DocumentKind> = {
  pdf: "pdf",
  docx: "word",
  doc: "word",
  docm: "word",
  dotx: "word",
  dot: "word",
  rtf: "word",
  odt: "word",
  ott: "word",
  pptx: "presentation",
  ppt: "presentation",
  pptm: "presentation",
  ppsx: "presentation",
  pps: "presentation",
  potx: "presentation",
  pot: "presentation",
  odp: "presentation",
  otp: "presentation",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  xlsm: "spreadsheet",
  ods: "spreadsheet",
  ots: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  md: "structured",
  markdown: "structured",
  html: "structured",
  htm: "structured",
  epub: "structured",
  tex: "structured",
  txt: "text",
  json: "text",
  xml: "text",
};

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  pjpeg: "image/jpeg",
  pjp: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function ascii(buffer: Buffer, start: number, end: number): string {
  return buffer.subarray(start, Math.min(end, buffer.length)).toString("latin1");
}

export function sniffMime(buffer: Buffer): string | null {
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(buffer, 0, 4) === "GIF8") return "image/gif";
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP") return "image/webp";
  if (startsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])) return "image/tiff";
  if (startsWith(buffer, [0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
  if (ascii(buffer, 0, 2) === "BM") return "image/bmp";
  if (ascii(buffer, 4, 8) === "ftyp") {
    const header = ascii(buffer, 8, 64);
    if (/avi[fs]/.test(header)) return "image/avif";
    if (/hei[cmsx]|hev[cmsx]/.test(header)) return "image/heic";
    if (/mif1|msf1/.test(header)) return "image/heif";
  }
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "application/x-ole-storage";
  const head = ascii(buffer, 0, 512).trimStart().toLowerCase();
  if (head.includes("<svg")) return "image/svg+xml";
  return null;
}

export interface DetectedFile {
  kind: DocumentKind;
  extension: string;
  mime: string;
}

export function detectFile(name: string, browserMime: string, buffer: Buffer): DetectedFile {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  const extension = match ? match[1].toLowerCase() : "";
  const sniffed = sniffMime(buffer);

  if (sniffed === "application/pdf") return { kind: "pdf", extension: extension || "pdf", mime: sniffed };

  const imageMimeFromExtension = IMAGE_MIME_BY_EXTENSION[extension];
  if (sniffed?.startsWith("image/")) {
    return { kind: "image", extension: extension || sniffed.split("/")[1], mime: sniffed };
  }
  if (imageMimeFromExtension) return { kind: "image", extension, mime: imageMimeFromExtension };

  const kind = KIND_BY_EXTENSION[extension];
  if (kind) return { kind, extension, mime: browserMime || "application/octet-stream" };

  if (browserMime.startsWith("image/")) return { kind: "image", extension, mime: browserMime };
  if (browserMime.startsWith("text/")) return { kind: "text", extension, mime: browserMime };

  return { kind: "unsupported", extension, mime: browserMime || "application/octet-stream" };
}
