"use client";

import { Check, X } from "lucide-react";
import type { QuestionInputProps } from "./types";

const CHOICES = [
  { value: true, label: "Verdadero" },
  { value: false, label: "Falso" },
];

export function TrueFalseQuestion({ question, response, onChange, review, disabled }: QuestionInputProps<"true_false">) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {CHOICES.map((choice) => {
        const isSelected = response.value === choice.value;
        const isCorrect = question.correctBoolean === choice.value;
        let style = isSelected ? "border-papa-500 bg-papa-50 shadow-sm" : "border-papa-100 bg-white hover:border-papa-300";
        if (review) {
          if (isCorrect) style = "border-brote-500 bg-brote-50";
          else if (isSelected) style = "border-tomate-500 bg-tomate-50";
          else style = "border-papa-100 bg-white opacity-70";
        }
        return (
          <button
            key={choice.label}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled && !review}
            onClick={() => !review && !disabled && onChange({ type: "true_false", value: choice.value })}
            className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-5 font-display text-lg font-semibold text-papa-900 transition ${style}`}
          >
            {review && isCorrect && <Check className="size-5 text-brote-600" aria-hidden />}
            {review && isSelected && !isCorrect && <X className="size-5 text-tomate-600" aria-hidden />}
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
