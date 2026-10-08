import type { Question, UserResponse } from "./types";

export function describeUserAnswer(question: Question, response: UserResponse | undefined): string {
  if (!response) return "Sin responder";
  switch (response.type) {
    case "single_choice":
      return question.options?.find((option) => option.id === response.optionId)?.text ?? "Sin responder";
    case "multiple_choice":
      return (
        (question.options ?? [])
          .filter((option) => response.optionIds.includes(option.id))
          .map((option) => option.text)
          .join("; ") || "Sin responder"
      );
    case "true_false":
      return response.value === null ? "Sin responder" : response.value ? "Verdadero" : "Falso";
    case "fill_blank":
      return response.values.map((value) => value.trim() || "(vacío)").join(" · ");
    case "short_answer":
    case "open_ended":
      return response.text.trim() || "Sin responder";
    case "matching":
      return (question.pairs ?? [])
        .map((pair, index) => {
          const chosen = response.matches[index];
          return `${pair.left} → ${chosen === null || chosen === undefined ? "?" : question.pairs?.[chosen]?.right ?? "?"}`;
        })
        .join("; ");
    case "ordering":
      return response.order.map((index) => question.orderedItems?.[index] ?? "?").join(" → ");
  }
}

export function describeCorrectAnswer(question: Question): string {
  switch (question.type) {
    case "single_choice":
    case "multiple_choice":
      return (question.options ?? [])
        .filter((option) => question.correctOptionIds?.includes(option.id))
        .map((option) => option.text)
        .join("; ");
    case "true_false":
      return question.correctBoolean ? "Verdadero" : "Falso";
    case "fill_blank":
      return (question.blanks ?? []).map((blank) => blank.accepted[0]).join(" · ");
    case "matching":
      return (question.pairs ?? []).map((pair) => `${pair.left} → ${pair.right}`).join("; ");
    case "ordering":
      return (question.orderedItems ?? []).join(" → ");
    default:
      return question.modelAnswer;
  }
}
