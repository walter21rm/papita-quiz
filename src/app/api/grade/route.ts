import { AppError, errorResponse } from "@/lib/errors";
import { assertApiKey, generateJson, MODELS } from "@/lib/gemini";
import { describeAnswer, verdictFromScore } from "@/lib/grading";
import { buildGradePrompt, GRADE_SYSTEM } from "@/lib/prompts";
import { gradeJsonSchema, gradeRequestSchema, rawGradeSchema } from "@/lib/schemas";
import type { GradeResult } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertApiKey();
    const body = await request.json().catch(() => null);
    const parsed = gradeRequestSchema.safeParse(body);
    if (!parsed.success) throw new AppError("bad_request", "La respuesta enviada no es válida.");
    const { question, response, final } = parsed.data;
    if (!["fill_blank", "short_answer", "open_ended"].includes(question.type) || response.type !== question.type) {
      throw new AppError("bad_request", "Este tipo de pregunta se corrige sin IA.");
    }

    const raw = await generateJson({
      model: MODELS.fast,
      system: GRADE_SYSTEM,
      input: [{ type: "text", text: buildGradePrompt(question, describeAnswer(question, response), final) }],
      schema: gradeJsonSchema,
      thinking: "low",
    });
    const grade = rawGradeSchema.parse(raw);
    const feedback = grade.feedback.trim() || undefined;

    let result: GradeResult;
    if (question.type === "fill_blank" && response.type === "fill_blank") {
      const blanks = question.blanks ?? [];
      const blankResults = blanks.map((_, index) => {
        const empty = (response.values[index] ?? "").trim() === "";
        return !empty && (grade.blankResults?.[index] ?? false);
      });
      const score = blanks.length ? blankResults.filter(Boolean).length / blanks.length : 0;
      result = { verdict: verdictFromScore(score), score, feedback, blankResults };
    } else if (question.type === "short_answer") {
      const score = grade.verdict === "correct" ? 1 : grade.verdict === "partial" ? 0.5 : 0;
      result = { verdict: grade.verdict, score, feedback };
    } else {
      const score = Math.min(1, Math.max(0, grade.score));
      const verdict = score >= 0.85 ? "correct" : score >= 0.4 ? "partial" : "incorrect";
      result = { verdict, score: verdict === "correct" ? 1 : score, feedback };
    }

    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
