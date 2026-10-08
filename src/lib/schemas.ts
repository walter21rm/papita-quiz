import { z } from "zod";
import { LEVELS, QUESTION_TYPES } from "./types";

// ---------- JSON Schemas sent to Gemini (subset supported by structured output) ----------
// Nested minItems/maxItems make Gemini reject the schema as "invalid argument"; sizes are
// requested in the prompt and enforced when normalizing the answer instead.

const stringArray = (description: string) => ({
  type: "array",
  description,
  items: { type: "string" },
});

export const analysisJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Título corto y claro del material, máximo 80 caracteres." },
    materialType: {
      type: "string",
      description: "Tipo de material, por ejemplo: diapositivas de clase, apuntes a mano, libro, artículo, guía de práctica.",
    },
    language: { type: "string", description: "Código ISO 639-1 del idioma original del material (es, en, pt...)." },
    summary: { type: "string", description: "Resumen del material en 3 a 6 oraciones, en español." },
    topics: {
      type: "array",
      description: "Entre 1 y 15 temas.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", description: "Una o dos oraciones sobre el tema." },
          importance: { type: "integer", minimum: 1, maximum: 3, description: "3 = central, 1 = detalle menor." },
          concepts: {
            type: "array",
            description: "Entre 1 y 15 conceptos evaluables del tema.",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                explanation: { type: "string", description: "Explicación breve y fiel al material." },
                keyFacts: stringArray("De 1 a 8 hechos verificables tal como aparecen en el material."),
                source: { type: "string", description: "Archivo y página, diapositiva u hoja donde aparece." },
              },
              required: ["name", "explanation", "keyFacts", "source"],
            },
          },
        },
        required: ["name", "description", "importance", "concepts"],
      },
    },
    warnings: stringArray("Partes ilegibles, borrosas, cortadas o sin contenido académico. Vacío si todo está bien."),
    capacity: {
      type: "object",
      description: "Cuántas preguntas distintas y no repetitivas se pueden hacer en cada nivel.",
      properties: Object.fromEntries(LEVELS.map((level) => [level, { type: "integer", minimum: 0 }])),
      required: [...LEVELS],
    },
  },
  required: ["title", "materialType", "language", "summary", "topics", "warnings", "capacity"],
};

export const quizJsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...QUESTION_TYPES] },
          prompt: { type: "string", description: "Enunciado en Markdown. En fill_blank cada espacio es ____." },
          options: stringArray("Solo single_choice y multiple_choice: textos de las opciones, sin letras."),
          correctOptions: {
            type: "array",
            description: "Solo single_choice y multiple_choice: índices (desde 0) de las opciones correctas.",
            items: { type: "integer", minimum: 0 },
          },
          correctBoolean: { type: "boolean", description: "Solo true_false." },
          blanks: {
            type: "array",
            description: "Solo fill_blank: un elemento por cada ____ en orden.",
            items: {
              type: "object",
              properties: { accepted: stringArray("Respuestas válidas; la principal primero.") },
              required: ["accepted"],
            },
          },
          acceptedAnswers: stringArray("Solo short_answer: todas las variantes válidas de la respuesta."),
          pairs: {
            type: "array",
            description: "Solo matching: parejas correctas.",
            items: {
              type: "object",
              properties: { left: { type: "string" }, right: { type: "string" } },
              required: ["left", "right"],
            },
          },
          orderedItems: stringArray("Solo ordering: elementos en el orden correcto."),
          rubric: stringArray("Solo open_ended: puntos clave que debe mencionar una buena respuesta."),
          modelAnswer: { type: "string", description: "La respuesta correcta expresada en texto." },
          hints: stringArray("Exactamente 3 pistas progresivas, de sutil a casi la respuesta."),
          explanation: { type: "string", description: "Por qué la respuesta es correcta (y por qué las otras no)." },
          source: { type: "string", description: "Archivo y página o diapositiva de donde sale la pregunta." },
          conceptIds: stringArray("IDs de los conceptos evaluados, tomados del mapa de conocimiento."),
        },
        required: ["type", "prompt", "modelAnswer", "hints", "explanation", "source", "conceptIds"],
      },
    },
  },
  required: ["questions"],
};

export const gradeJsonSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["correct", "partial", "incorrect"] },
    score: { type: "number", minimum: 0, maximum: 1, description: "Puntaje de 0 a 1." },
    feedback: { type: "string", description: "Retroalimentación breve para el estudiante, en español." },
    blankResults: {
      type: "array",
      description: "Solo para completar espacios: true si cada espacio es correcto, en orden.",
      items: { type: "boolean" },
    },
  },
  required: ["verdict", "score", "feedback"],
};

// ---------- Validators for Gemini output ----------

const looseString = z.string().catch("");
const looseStrings = z.array(z.string()).catch([]);

export const rawAnalysisSchema = z.object({
  title: looseString,
  materialType: looseString,
  language: z.string().catch("es"),
  summary: looseString,
  topics: z
    .array(
      z.object({
        name: z.string(),
        description: looseString,
        importance: z.coerce.number().catch(2),
        concepts: z
          .array(
            z.object({
              name: z.string(),
              explanation: looseString,
              keyFacts: looseStrings,
              source: looseString,
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
  warnings: looseStrings,
  capacity: z.record(z.string(), z.coerce.number()).catch({}),
});

export const rawQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  options: z.array(z.string()).optional().catch(undefined),
  correctOptions: z.array(z.coerce.number()).optional().catch(undefined),
  correctBoolean: z.boolean().optional().catch(undefined),
  blanks: z.array(z.object({ accepted: z.array(z.string()) })).optional().catch(undefined),
  acceptedAnswers: z.array(z.string()).optional().catch(undefined),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).optional().catch(undefined),
  orderedItems: z.array(z.string()).optional().catch(undefined),
  rubric: z.array(z.string()).optional().catch(undefined),
  modelAnswer: looseString,
  hints: looseStrings,
  explanation: looseString,
  source: looseString,
  conceptIds: looseStrings,
});
export type RawQuestion = z.infer<typeof rawQuestionSchema>;

export const rawGradeSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect"]).catch("incorrect"),
  score: z.coerce.number().catch(0),
  feedback: looseString,
  blankResults: z.array(z.boolean()).optional().catch(undefined),
});

// ---------- Validators for API requests ----------

const levelSchema = z.enum(LEVELS);
const questionTypeSchema = z.enum(QUESTION_TYPES);

export const corpusPartSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), label: z.string(), text: z.string() }),
  z.object({
    kind: z.literal("media"),
    label: z.string(),
    mediaType: z.enum(["document", "image"]),
    mimeType: z.string(),
    size: z.number(),
    data: z.string().optional().default(""),
    fileUri: z.string().optional(),
    fileExpiresAt: z.number().optional(),
  }),
]);

export const quizConfigSchema = z.object({
  level: levelSchema,
  count: z.number().int().min(1).max(30),
  types: z.array(questionTypeSchema).min(1),
  topicIds: z.array(z.string()),
  language: z.enum(["es", "original"]),
  focusConceptIds: z.array(z.string()),
});

const conceptSchema = z.object({
  id: z.string(),
  name: z.string(),
  explanation: z.string(),
  keyFacts: z.array(z.string()),
  source: z.string(),
});

export const knowledgeSchema = z.object({
  title: z.string(),
  language: z.string(),
  topics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      importance: z.number(),
      concepts: z.array(conceptSchema),
    }),
  ),
});

export const priorQuestionSchema = z.object({
  type: questionTypeSchema,
  prompt: z.string(),
  answer: z.string(),
  conceptIds: z.array(z.string()).default([]),
});
export type PriorQuestion = z.infer<typeof priorQuestionSchema>;

export const quizRequestSchema = z.object({
  corpus: z.array(corpusPartSchema).min(1),
  knowledge: knowledgeSchema,
  config: quizConfigSchema,
  count: z.number().int().min(1).max(30),
  existing: z.array(priorQuestionSchema),
  history: z.array(priorQuestionSchema),
});

const questionSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  level: levelSchema,
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
  correctOptionIds: z.array(z.string()).optional(),
  correctBoolean: z.boolean().optional(),
  blanks: z.array(z.object({ accepted: z.array(z.string()) })).optional(),
  acceptedAnswers: z.array(z.string()).optional(),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).optional(),
  orderedItems: z.array(z.string()).optional(),
  rubric: z.array(z.string()).optional(),
  modelAnswer: z.string(),
  hints: z.array(z.string()),
  explanation: z.string(),
  source: z.string(),
  conceptIds: z.array(z.string()),
});

const userResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single_choice"), optionId: z.string().nullable() }),
  z.object({ type: z.literal("multiple_choice"), optionIds: z.array(z.string()) }),
  z.object({ type: z.literal("true_false"), value: z.boolean().nullable() }),
  z.object({ type: z.literal("fill_blank"), values: z.array(z.string()) }),
  z.object({ type: z.literal("short_answer"), text: z.string() }),
  z.object({ type: z.literal("open_ended"), text: z.string() }),
  z.object({ type: z.literal("matching"), matches: z.array(z.number().nullable()) }),
  z.object({ type: z.literal("ordering"), order: z.array(z.number()) }),
]);

export const gradeRequestSchema = z.object({
  question: questionSchema,
  response: userResponseSchema,
  final: z.boolean(),
});
