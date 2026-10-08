import { createId } from "./fingerprint";
import type { RawQuestion } from "./schemas";
import type { Level, Question, QuestionType } from "./types";

const BLANK_PATTERN = /_{3,}|\[\s*_*\s*\]|\(\s*_{2,}\s*\)/g;
const OPTION_IDS = "abcdefgh";

function clean(text: string | undefined): string {
  return (text ?? "").replace(/[ \t]+\n/g, "\n").trim();
}

function uniqueStrings(list: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list ?? []) {
    const value = clean(item);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function completeHints(hints: string[], source: string): string[] {
  const result = hints.slice(0, 3);
  const fallbacks = [
    "Lee el enunciado con calma y piensa en qué tema de tu material aparece esta idea.",
    source ? `Repasa esta parte de tu material: ${source}.` : "Descarta primero lo que sabes que no es correcto.",
    "Recuerda la definición exacta del concepto principal de la pregunta.",
  ];
  for (const fallback of fallbacks) {
    if (result.length >= 3) break;
    if (!result.includes(fallback)) result.push(fallback);
  }
  return result;
}

export interface NormalizeContext {
  level: Level;
  allowedTypes: QuestionType[];
  conceptIds: Set<string>;
}

export function normalizeQuestion(raw: RawQuestion, context: NormalizeContext): Question | null {
  let type: QuestionType = raw.type;
  let prompt = clean(raw.prompt);
  if (!prompt) return null;

  const source = clean(raw.source);
  const question: Question = {
    id: createId(),
    type,
    level: context.level,
    prompt,
    modelAnswer: clean(raw.modelAnswer),
    hints: [],
    explanation: clean(raw.explanation),
    source,
    conceptIds: uniqueStrings(raw.conceptIds).filter((id) => context.conceptIds.has(id)),
  };

  switch (type) {
    case "single_choice":
    case "multiple_choice": {
      const options = (raw.options ?? []).map(clean).filter(Boolean);
      if (options.length < 3 || options.length > 7) return null;
      if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return null;
      const correct = [...new Set(raw.correctOptions ?? [])].filter(
        (index) => Number.isInteger(index) && index >= 0 && index < options.length,
      );
      if (correct.length === 0) return null;
      if (type === "single_choice" && correct.length > 1) type = "multiple_choice";
      if (type === "multiple_choice" && correct.length === options.length) return null;

      const shuffled = shuffle(options.map((text, index) => ({ text, correct: correct.includes(index) })));
      question.options = shuffled.map((option, index) => ({ id: OPTION_IDS[index], text: option.text }));
      question.correctOptionIds = shuffled.flatMap((option, index) => (option.correct ? [OPTION_IDS[index]] : []));
      question.modelAnswer ||= shuffled.filter((option) => option.correct).map((option) => option.text).join("; ");
      break;
    }
    case "true_false": {
      if (typeof raw.correctBoolean !== "boolean") return null;
      question.correctBoolean = raw.correctBoolean;
      question.modelAnswer ||= raw.correctBoolean ? "Verdadero" : "Falso";
      break;
    }
    case "fill_blank": {
      prompt = prompt.replace(BLANK_PATTERN, "____");
      const blankCount = (prompt.match(/____/g) ?? []).length;
      const blanks = (raw.blanks ?? [])
        .map((blank) => ({ accepted: uniqueStrings(blank.accepted) }))
        .filter((blank) => blank.accepted.length > 0);
      if (blankCount === 0 || blankCount > 4 || blankCount !== blanks.length) return null;
      question.prompt = prompt;
      question.blanks = blanks;
      question.modelAnswer ||= blanks.map((blank) => blank.accepted[0]).join(", ");
      break;
    }
    case "short_answer": {
      let accepted = uniqueStrings(raw.acceptedAnswers);
      if (accepted.length === 0 && question.modelAnswer && question.modelAnswer.length <= 60) {
        accepted = [question.modelAnswer];
      }
      if (accepted.length === 0) return null;
      question.acceptedAnswers = accepted;
      question.modelAnswer ||= accepted[0];
      break;
    }
    case "open_ended": {
      const rubric = uniqueStrings(raw.rubric);
      if (rubric.length === 0 || !question.modelAnswer) return null;
      question.rubric = rubric.slice(0, 6);
      break;
    }
    case "matching": {
      const pairs = (raw.pairs ?? [])
        .map((pair) => ({ left: clean(pair.left), right: clean(pair.right) }))
        .filter((pair) => pair.left && pair.right);
      const lefts = new Set(pairs.map((pair) => pair.left.toLowerCase()));
      const rights = new Set(pairs.map((pair) => pair.right.toLowerCase()));
      if (pairs.length < 3 || pairs.length > 8 || lefts.size !== pairs.length || rights.size !== pairs.length) {
        return null;
      }
      question.pairs = pairs;
      question.modelAnswer ||= pairs.map((pair) => `${pair.left} → ${pair.right}`).join("; ");
      break;
    }
    case "ordering": {
      const items = uniqueStrings(raw.orderedItems);
      if (items.length < 3 || items.length > 8 || items.length !== (raw.orderedItems ?? []).length) return null;
      question.orderedItems = items;
      question.modelAnswer ||= items.join(" → ");
      break;
    }
  }

  if (!context.allowedTypes.includes(type)) return null;
  question.type = type;
  question.hints = completeHints(uniqueStrings(raw.hints), source);
  question.explanation ||= question.modelAnswer;
  return question;
}
