import { stripAccents } from "./text";
import type { Question, QuestionType } from "./types";

export interface ComparableQuestion {
  type: QuestionType;
  prompt: string;
  answer: string;
}

const STOPWORDS = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante antes como con contra cual cuales cuando de del desde donde " +
    "durante e el ella ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos fue fueron ha han " +
    "hay la las le les lo los mas me mi muy no nos o otra otras otro otros para pero por porque que quien se segun ser " +
    "si sin sobre su sus tambien tiene tienen todo todos tu un una unas uno unos y ya cual cuales cuanto cuantos " +
    "siguiente siguientes correcta correcto correctas correctos afirmacion opcion opciones verdadero falso indica " +
    "selecciona marca elige menciona explica describe identifica the of and or to in is are what which who how why"
  ).split(" "),
);

function normalize(text: string): string {
  return stripAccents(text.toLowerCase())
    .replace(/\$[^$]*\$/g, (formula) => formula.replace(/\s+/g, ""))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordStems(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((word) => word.length > 1 && !STOPWORDS.has(word))
      .map((word) => (word.length > 5 ? word.slice(0, 5) : word)),
  );
}

function trigrams(text: string): Set<string> {
  const compact = ` ${normalize(text)} `;
  const grams = new Set<string>();
  for (let i = 0; i < compact.length - 2; i++) grams.add(compact.slice(i, i + 3));
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared++;
  return shared / (a.size + b.size - shared);
}

export function textSimilarity(a: string, b: string): number {
  return 0.6 * jaccard(wordStems(a), wordStems(b)) + 0.4 * jaccard(trigrams(a), trigrams(b));
}

export function answerKey(question: Question): string {
  switch (question.type) {
    case "single_choice":
    case "multiple_choice":
      return (question.options ?? [])
        .filter((option) => question.correctOptionIds?.includes(option.id))
        .map((option) => option.text)
        .sort()
        .join(" | ");
    case "fill_blank":
      return (question.blanks ?? []).map((blank) => blank.accepted[0] ?? "").join(" | ");
    case "short_answer":
      return question.acceptedAnswers?.[0] ?? question.modelAnswer;
    case "matching":
      return (question.pairs ?? []).map((pair) => `${pair.left} = ${pair.right}`).sort().join(" | ");
    case "ordering":
      return (question.orderedItems ?? []).join(" > ");
    default:
      return "";
  }
}

export function toComparable(question: Question): ComparableQuestion {
  return { type: question.type, prompt: question.prompt, answer: answerKey(question) };
}

// Lexical checks catch near-verbatim repeats; paraphrases with synonyms are handled by sending the
// question history to the model.
export function isNearDuplicate(a: ComparableQuestion, b: ComparableQuestion): boolean {
  const promptSimilarity = textSimilarity(a.prompt, b.prompt);
  if (promptSimilarity >= 0.72) return true;
  if (!a.answer || !b.answer) return false;
  const answerSimilarity =
    normalize(a.answer) === normalize(b.answer) ? 1 : textSimilarity(a.answer, b.answer);
  const structured = (a.type === "matching" || a.type === "ordering") && a.type === b.type;
  if (structured && answerSimilarity >= 0.7) return true;
  if (answerSimilarity >= 0.9) return promptSimilarity >= 0.25;
  return promptSimilarity >= 0.45 && answerSimilarity >= 0.8;
}

/** Splits candidates into those that are new and those too close to prior questions (or to each other). */
export function filterNewQuestions(
  candidates: Question[],
  prior: ComparableQuestion[],
): { accepted: Question[]; rejected: Question[] } {
  const accepted: Question[] = [];
  const rejected: Question[] = [];
  const seen = [...prior];
  for (const candidate of candidates) {
    const comparable = toComparable(candidate);
    if (seen.some((previous) => isNearDuplicate(comparable, previous))) {
      rejected.push(candidate);
      continue;
    }
    accepted.push(candidate);
    seen.push(comparable);
  }
  return { accepted, rejected };
}
