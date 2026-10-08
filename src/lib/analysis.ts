import { AppError } from "./errors";
import { rawAnalysisSchema } from "./schemas";
import { LEVELS, type MaterialAnalysis, type Topic } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAnalysis(raw: unknown, fallbackTitle: string): MaterialAnalysis {
  const parsed = rawAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("ai_bad_response", "La IA devolvió un análisis incompleto. Vuelve a intentarlo.");
  }
  const data = parsed.data;

  const topics: Topic[] = data.topics
    .filter((topic) => topic.name.trim())
    .slice(0, 15)
    .map((topic, topicIndex) => ({
      id: `t${topicIndex + 1}`,
      name: topic.name.trim(),
      description: topic.description.trim(),
      importance: clamp(Math.round(topic.importance) || 2, 1, 3),
      concepts: topic.concepts
        .filter((concept) => concept.name.trim())
        .slice(0, 15)
        .map((concept, conceptIndex) => ({
          id: `t${topicIndex + 1}c${conceptIndex + 1}`,
          name: concept.name.trim(),
          explanation: concept.explanation.trim(),
          keyFacts: concept.keyFacts.map((fact) => fact.trim()).filter(Boolean).slice(0, 8),
          source: concept.source.trim(),
        })),
    }))
    .filter((topic) => topic.concepts.length > 0);

  if (topics.length === 0) {
    throw new AppError(
      "unreadable_files",
      "No encontré contenido para estudiar en tus archivos. Prueba con otro documento o con fotos más nítidas.",
      data.warnings,
    );
  }

  const conceptTotal = topics.reduce((sum, topic) => sum + topic.concepts.length, 0);
  const capacity = Object.fromEntries(
    LEVELS.map((level) => {
      const estimate = data.capacity[level];
      const value = Number.isFinite(estimate) && estimate > 0 ? estimate : conceptTotal * 2;
      return [level, clamp(Math.round(value), 3, 500)];
    }),
  ) as MaterialAnalysis["capacity"];

  return {
    title: data.title.trim().slice(0, 120) || fallbackTitle,
    materialType: data.materialType.trim(),
    language: data.language.trim().toLowerCase().slice(0, 8) || "es",
    summary: data.summary.trim(),
    topics,
    warnings: data.warnings.map((warning) => warning.trim()).filter(Boolean),
    capacity,
  };
}
