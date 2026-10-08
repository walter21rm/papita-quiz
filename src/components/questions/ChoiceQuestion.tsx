"use client";

import { Check, X } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import type { QuestionInputProps } from "./types";

type ChoiceProps =
  | QuestionInputProps<"single_choice">
  | QuestionInputProps<"multiple_choice">;

export function ChoiceQuestion(props: ChoiceProps) {
  const { question, review, disabled } = props;
  const multiple = props.response.type === "multiple_choice";
  const selected = props.response.type === "multiple_choice" ? props.response.optionIds : [props.response.optionId];
  const correct = new Set(question.correctOptionIds ?? []);

  function toggle(optionId: string) {
    if (disabled || review) return;
    if (props.response.type === "multiple_choice") {
      const has = props.response.optionIds.includes(optionId);
      const optionIds = has
        ? props.response.optionIds.filter((id) => id !== optionId)
        : [...props.response.optionIds, optionId];
      (props as QuestionInputProps<"multiple_choice">).onChange({ type: "multiple_choice", optionIds });
    } else {
      (props as QuestionInputProps<"single_choice">).onChange({ type: "single_choice", optionId });
    }
  }

  return (
    <div role={multiple ? "group" : "radiogroup"} className="flex flex-col gap-2.5">
      {(question.options ?? []).map((option, index) => {
        const isSelected = selected.includes(option.id);
        const isCorrect = correct.has(option.id);
        let style = isSelected
          ? "border-papa-500 bg-papa-50 shadow-sm"
          : "border-papa-100 bg-white hover:border-papa-300";
        if (review) {
          if (isCorrect) style = "border-brote-500 bg-brote-50";
          else if (isSelected) style = "border-tomate-500 bg-tomate-50";
          else style = "border-papa-100 bg-white opacity-70";
        }
        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={isSelected}
            disabled={disabled && !review}
            onClick={() => toggle(option.id)}
            className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${style} ${
              review ? "cursor-default" : ""
            }`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center font-display text-sm font-bold ${
                multiple ? "rounded-lg" : "rounded-full"
              } ${
                review && isCorrect
                  ? "bg-brote-500 text-white"
                  : review && isSelected
                    ? "bg-tomate-500 text-white"
                    : isSelected
                      ? "bg-papa-500 text-white"
                      : "bg-papa-100 text-papa-700"
              }`}
              aria-hidden
            >
              {review && isCorrect ? (
                <Check className="size-4" />
              ) : review && isSelected ? (
                <X className="size-4" />
              ) : (
                String.fromCharCode(65 + index)
              )}
            </span>
            <Markdown inline className="pt-0.5 text-papa-900">
              {option.text}
            </Markdown>
          </button>
        );
      })}
    </div>
  );
}
