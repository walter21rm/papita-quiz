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
  minQuestions: 5,
  maxQuestions: 30,
} as const;

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
