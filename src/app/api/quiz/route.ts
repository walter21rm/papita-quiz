import { filterNewQuestions, toComparable, type ComparableQuestion } from "@/lib/dedupe";
import { AppError, errorResponse } from "@/lib/errors";
import { assertApiKey, corpusToInput, generateJson, MODELS } from "@/lib/gemini";
import { buildQuizPrompt, QUIZ_SYSTEM } from "@/lib/prompts";
import { batchTypeCounts } from "@/lib/quiz-plan";
import { normalizeQuestion } from "@/lib/question-normalize";
import { quizJsonSchema, quizRequestSchema, rawQuestionSchema, type PriorQuestion } from "@/lib/schemas";
import type { Question, QuestionType } from "@/lib/types";

export const maxDuration = 300;

const MAX_ROUNDS = 2;

export async function POST(request: Request) {
  try {
    assertApiKey();
    const body = await request.json().catch(() => null);
    const parsed = quizRequestSchema.safeParse(body);
    if (!parsed.success) throw new AppError("bad_request", "La solicitud para crear el quiz no es válida.");
    const { corpus, knowledge, config, count, existing, history } = parsed.data;

    const { input, updates } = await corpusToInput(corpus);

    const conceptIds = new Set(knowledge.topics.flatMap((topic) => topic.concepts.map((concept) => concept.id)));
    const conceptCounts: Record<string, number> = {};
    for (const question of [...history, ...existing]) {
      for (const id of question.conceptIds) conceptCounts[id] = (conceptCounts[id] ?? 0) + 1;
    }

    const prior: ComparableQuestion[] = [...history, ...existing];
    const accepted: Question[] = [];
    const rejectedPrompts: string[] = [];

    for (let round = 0; round < MAX_ROUNDS && accepted.length < count; round++) {
      const missing = count - accepted.length;
      // A small surplus absorbs questions dropped by validation or the repetition filter.
      const requested = round === 0 ? missing + Math.min(3, Math.ceil(missing * 0.2)) : missing;
      const existingTypes: QuestionType[] = [...existing, ...accepted].map((question) => question.type);
      const typeCounts = batchTypeCounts(
        config.types,
        config.level,
        config.count,
        existingTypes,
        requested,
      );
      const avoid: PriorQuestion[] = [
        ...history,
        ...existing,
        ...accepted.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          answer: question.modelAnswer,
          conceptIds: question.conceptIds,
        })),
      ];

      const raw = await generateJson({
        models: MODELS.main,
        system: QUIZ_SYSTEM,
        input: [
          ...input,
          {
            type: "text",
            text: buildQuizPrompt({
              topics: knowledge.topics,
              materialLanguage: knowledge.language,
              config,
              count: requested,
              typeCounts,
              conceptCounts,
              avoid,
              rejected: rejectedPrompts,
            }),
          },
        ],
        schema: quizJsonSchema,
        thinking: "medium",
      });

      const rawQuestions = Array.isArray((raw as { questions?: unknown })?.questions)
        ? ((raw as { questions: unknown[] }).questions)
        : [];
      const candidates = rawQuestions
        .map((item) => rawQuestionSchema.safeParse(item))
        .flatMap((result) => (result.success ? [result.data] : []))
        .map((item) => normalizeQuestion(item, { level: config.level, allowedTypes: config.types, conceptIds }))
        .filter((question): question is Question => question !== null);

      const { accepted: fresh, rejected } = filterNewQuestions(candidates, [
        ...prior,
        ...accepted.map(toComparable),
      ]);
      accepted.push(...fresh.slice(0, missing));
      rejectedPrompts.push(...rejected.map((question) => question.prompt));
    }
    const shortfall = count - accepted.length;

    if (accepted.length === 0) {
      throw new AppError(
        "ai_bad_response",
        "No pude crear preguntas nuevas esta vez. Vuelve a intentarlo, cambia el nivel o reinicia el historial de este material.",
      );
    }

    return Response.json({
      questions: accepted,
      exhausted: shortfall > 0 && rejectedPrompts.length >= shortfall,
      fileUpdates: updates,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
