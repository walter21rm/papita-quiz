import { shuffledIndices } from "./shuffle";
import { answersMatch } from "./text";
import type { AnswerRecord, GradeResult, Question, UserResponse, Verdict } from "./types";

export const MAX_CHECKS = 2;
export const MAX_HINTS = 3;
const PENALTY_PER_HELP = 0.25;
const MIN_FACTOR = 0.25;

export function verdictFromScore(score: number): Verdict {
  if (score >= 0.999) return "correct";
  return score > 0 ? "partial" : "incorrect";
}

export function emptyResponse(question: Question): UserResponse {
  switch (question.type) {
    case "single_choice":
      return { type: "single_choice", optionId: null };
    case "multiple_choice":
      return { type: "multiple_choice", optionIds: [] };
    case "true_false":
      return { type: "true_false", value: null };
    case "fill_blank":
      return { type: "fill_blank", values: (question.blanks ?? []).map(() => "") };
    case "short_answer":
      return { type: "short_answer", text: "" };
    case "open_ended":
      return { type: "open_ended", text: "" };
    case "matching":
      return { type: "matching", matches: (question.pairs ?? []).map(() => null) };
    case "ordering":
      return { type: "ordering", order: shuffledIndices(question.orderedItems?.length ?? 0, `${question.id}:order`) };
  }
}

export function isAnswered(response: UserResponse): boolean {
  switch (response.type) {
    case "single_choice":
      return response.optionId !== null;
    case "multiple_choice":
      return response.optionIds.length > 0;
    case "true_false":
      return response.value !== null;
    case "fill_blank":
      return response.values.some((value) => value.trim() !== "");
    case "short_answer":
    case "open_ended":
      return response.text.trim() !== "";
    case "matching":
      return response.matches.every((match) => match !== null);
    case "ordering":
      return response.order.length > 0;
  }
}

function orderingScore(order: number[], size: number): number {
  if (order.length !== size || size < 2) return 0;
  let agreeing = 0;
  let total = 0;
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      total++;
      if (order[i] < order[j]) agreeing++;
    }
  }
  // Pairwise agreement rescaled so that a random order scores about 0 and the correct order 1.
  return Math.max(0, (agreeing / total - 0.5) / 0.5);
}

/**
 * Grades whatever can be graded in the browser. Returns `null` when the written answer has to be
 * checked by the AI (synonyms, paraphrases or open answers).
 */
export function gradeLocally(question: Question, response: UserResponse): GradeResult | null {
  switch (response.type) {
    case "single_choice": {
      const correct = response.optionId !== null && (question.correctOptionIds ?? []).includes(response.optionId);
      return { verdict: correct ? "correct" : "incorrect", score: correct ? 1 : 0 };
    }
    case "multiple_choice": {
      const expected = new Set(question.correctOptionIds ?? []);
      const right = response.optionIds.filter((id) => expected.has(id)).length;
      const wrong = response.optionIds.length - right;
      const exact = right === expected.size && wrong === 0;
      const score = exact ? 1 : Math.max(0, (right - wrong) / Math.max(expected.size, 1));
      return { verdict: exact ? "correct" : verdictFromScore(Math.min(score, 0.99)), score: exact ? 1 : Math.min(score, 0.99) };
    }
    case "true_false": {
      const correct = response.value !== null && response.value === question.correctBoolean;
      return { verdict: correct ? "correct" : "incorrect", score: correct ? 1 : 0 };
    }
    case "matching": {
      const total = question.pairs?.length ?? 0;
      const right = response.matches.filter((match, index) => match === index).length;
      const score = total ? right / total : 0;
      return { verdict: verdictFromScore(score), score };
    }
    case "ordering": {
      const score = orderingScore(response.order, question.orderedItems?.length ?? 0);
      return { verdict: verdictFromScore(score), score };
    }
    case "fill_blank": {
      const blanks = question.blanks ?? [];
      const results = blanks.map((blank, index) =>
        blank.accepted.some((accepted) => answersMatch(response.values[index] ?? "", accepted)),
      );
      const pendingForAi = results.some((ok, index) => !ok && (response.values[index] ?? "").trim() !== "");
      if (pendingForAi) return null;
      const score = blanks.length ? results.filter(Boolean).length / blanks.length : 0;
      return { verdict: verdictFromScore(score), score, blankResults: results };
    }
    case "short_answer": {
      if (!response.text.trim()) return { verdict: "incorrect", score: 0 };
      const accepted = question.acceptedAnswers ?? [];
      if (accepted.some((answer) => answersMatch(response.text, answer))) return { verdict: "correct", score: 1 };
      return null;
    }
    case "open_ended":
      return response.text.trim() ? null : { verdict: "incorrect", score: 0 };
  }
}

/** Each hint used and each extra attempt removes 25 % of the question's value (never below 25 %). */
export function applyPenalty(rawScore: number, hintsUsed: number, checks: number): number {
  const helps = hintsUsed + Math.max(0, checks - 1);
  return rawScore * Math.max(MIN_FACTOR, 1 - PENALTY_PER_HELP * helps);
}

export function describeAnswer(question: Question, response: UserResponse): string {
  switch (response.type) {
    case "fill_blank":
      return response.values.map((value, index) => `Espacio ${index + 1}: ${value.trim() || "(vacío)"}`).join("\n");
    case "short_answer":
    case "open_ended":
      return response.text.trim();
    default:
      return JSON.stringify(response);
  }
}

export interface QuizSummary {
  score: number;
  grade20: number;
  correct: number;
  partial: number;
  incorrect: number;
  hintsUsed: number;
  answered: number;
}

export function summarize(questions: Question[], answers: Record<string, AnswerRecord>): QuizSummary {
  let total = 0;
  const summary = { correct: 0, partial: 0, incorrect: 0, hintsUsed: 0, answered: 0 };
  for (const question of questions) {
    const answer = answers[question.id];
    if (!answer?.done) continue;
    summary.answered++;
    total += answer.score;
    summary.hintsUsed += answer.hintsUsed;
    if (answer.verdict === "correct") summary.correct++;
    else if (answer.verdict === "partial") summary.partial++;
    else summary.incorrect++;
  }
  const score = questions.length ? total / questions.length : 0;
  return { ...summary, score, grade20: Math.round(score * 20) };
}
