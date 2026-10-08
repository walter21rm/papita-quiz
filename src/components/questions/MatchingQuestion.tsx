"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { useMemo } from "react";
import { Markdown } from "@/components/Markdown";
import { shuffledIndices } from "@/lib/shuffle";
import type { QuestionInputProps } from "./types";

export function MatchingQuestion({ question, response, onChange, review, disabled }: QuestionInputProps<"matching">) {
  const pairs = useMemo(() => question.pairs ?? [], [question.pairs]);
  const rightOrder = useMemo(() => shuffledIndices(pairs.length, `${question.id}:right`), [pairs.length, question.id]);

  function choose(leftIndex: number, value: string) {
    const matches = [...response.matches];
    matches[leftIndex] = value === "" ? null : Number(value);
    onChange({ type: "matching", matches });
  }

  return (
    <div className="flex flex-col gap-3">
      {pairs.map((pair, leftIndex) => {
        const chosen = response.matches[leftIndex];
        const isCorrect = chosen === leftIndex;
        const usedElsewhere = new Set(response.matches.filter((match, index) => index !== leftIndex && match !== null));
        let style = "border-papa-100 bg-white";
        if (review) style = isCorrect ? "border-brote-500 bg-brote-50" : "border-tomate-500 bg-tomate-50";
        return (
          <div
            key={pair.left}
            className={`grid gap-2 rounded-2xl border-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] sm:items-center ${style}`}
          >
            <div className="flex items-center gap-2 font-bold text-papa-900">
              {review && (isCorrect ? <Check className="size-4 shrink-0 text-brote-600" /> : <X className="size-4 shrink-0 text-tomate-600" />)}
              <Markdown inline>{pair.left}</Markdown>
            </div>
            <ArrowRight className="hidden size-4 text-papa-400 sm:block" aria-hidden />
            <div className="flex flex-col gap-1">
              <select
                value={chosen === null || chosen === undefined ? "" : String(chosen)}
                onChange={(event) => choose(leftIndex, event.target.value)}
                disabled={disabled || review}
                aria-label={`Pareja de ${pair.left}`}
                className="w-full rounded-xl border-2 border-papa-200 bg-white px-3 py-2 text-papa-900 outline-none focus:border-papa-500 disabled:opacity-100"
              >
                <option value="">Elige…</option>
                {rightOrder.map((rightIndex) => (
                  <option key={rightIndex} value={rightIndex}>
                    {usedElsewhere.has(rightIndex) ? "• " : ""}
                    {pairs[rightIndex].right}
                  </option>
                ))}
              </select>
              {review && !isCorrect && (
                <p className="text-sm text-brote-700">
                  Correcto: <strong>{pair.right}</strong>
                </p>
              )}
            </div>
          </div>
        );
      })}
      {!review && <p className="text-xs text-papa-800/60">Las opciones marcadas con • ya las usaste en otra fila.</p>}
    </div>
  );
}
