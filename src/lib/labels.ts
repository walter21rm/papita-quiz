import type { Level, QuestionType } from "./types";

export const LEVEL_INFO: Record<Level, { label: string; short: string; description: string }> = {
  basico: {
    label: "Básico",
    short: "Recordar y comprender",
    description: "Definiciones, datos y conceptos que aparecen tal cual en tu material.",
  },
  intermedio: {
    label: "Intermedio",
    short: "Comprender y aplicar",
    description: "Relaciones entre ideas, ejemplos y aplicación directa de lo aprendido.",
  },
  avanzado: {
    label: "Avanzado",
    short: "Analizar",
    description: "Casos, comparaciones y causa-efecto, con distractores más finos.",
  },
  experto: {
    label: "Experto",
    short: "Evaluar e integrar",
    description: "Escenarios nuevos que combinan varios temas y preguntas de desarrollo.",
  },
};

export type QuestionGroup = "marcar" | "escribir" | "ordenar";

export const QUESTION_TYPE_INFO: Record<
  QuestionType,
  { label: string; group: QuestionGroup; instruction: string }
> = {
  single_choice: { label: "Opción única", group: "marcar", instruction: "Marca la respuesta correcta." },
  multiple_choice: {
    label: "Opción múltiple",
    group: "marcar",
    instruction: "Marca todas las respuestas correctas (puede haber más de una).",
  },
  true_false: { label: "Verdadero o falso", group: "marcar", instruction: "¿Verdadero o falso?" },
  fill_blank: { label: "Completar espacios", group: "escribir", instruction: "Escribe la palabra que falta en cada espacio." },
  short_answer: { label: "Respuesta corta", group: "escribir", instruction: "Responde con pocas palabras." },
  open_ended: { label: "Desarrollo", group: "escribir", instruction: "Explica con tus propias palabras." },
  matching: { label: "Relacionar columnas", group: "ordenar", instruction: "Une cada elemento con su pareja." },
  ordering: { label: "Ordenar pasos", group: "ordenar", instruction: "Arrastra los elementos hasta dejarlos en el orden correcto." },
};

export const QUESTION_GROUP_LABEL: Record<QuestionGroup, string> = {
  marcar: "Para marcar",
  escribir: "Para escribir",
  ordenar: "Para ordenar y unir",
};

export const LIMITS = {
  maxFiles: 20,
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalBytes: 150 * 1024 * 1024,
  // Vercel Hobby rejects bodies over ~4.5 MB (HTTP 413); stay under that per request.
  gatewayBytes: 3.5 * 1024 * 1024,
  uploadChunkBytes: 2 * 1024 * 1024,
  minQuestions: 5,
  maxQuestions: 30,
} as const;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  dot: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  docm: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ott: "application/vnd.oasis.opendocument.text",
  ppt: "application/vnd.ms-powerpoint",
  pps: "application/vnd.ms-powerpoint",
  pot: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pptm: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppsx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  potx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  otp: "application/vnd.oasis.opendocument.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  ots: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  epub: "application/epub+zip",
  tex: "application/x-tex",
  json: "application/json",
  xml: "application/xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

export function mimeForFile(fileName: string, browserType = ""): string {
  if (browserType && browserType !== "application/octet-stream") return browserType;
  return MIME_BY_EXTENSION[extensionOf(fileName)] ?? "application/octet-stream";
}

export const FORMAT_GROUPS: { label: string; extensions: string[] }[] = [
  { label: "PDF", extensions: ["pdf"] },
  { label: "Word", extensions: ["docx", "doc", "docm", "dotx", "dot", "rtf", "odt", "ott"] },
  { label: "PowerPoint", extensions: ["pptx", "ppt", "pptm", "ppsx", "pps", "potx", "pot", "odp", "otp"] },
  { label: "Excel", extensions: ["xlsx", "xls", "xlsm", "ods", "ots", "csv", "tsv"] },
  {
    label: "Imágenes",
    extensions: ["jpg", "jpeg", "jfif", "png", "webp", "heic", "heif", "gif", "bmp", "tif", "tiff", "avif", "svg", "ico"],
  },
  { label: "Texto", extensions: ["txt", "md", "markdown", "html", "htm", "epub", "tex", "json", "xml"] },
];

export const ACCEPTED_EXTENSIONS = new Set(FORMAT_GROUPS.flatMap((group) => group.extensions));

export function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
