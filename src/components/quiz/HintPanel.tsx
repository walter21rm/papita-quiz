"use client";

import { Lightbulb } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { MAX_HINTS } from "@/lib/grading";

interface HintPanelProps {
  hints: string[];
  used: number;
  canAsk: boolean;
  highlight: boolean;
  onAsk: () => void;
}

export function HintPanel({ hints, used, canAsk, highlight, onAsk }: HintPanelProps) {
  const total = Math.min(hints.length, MAX_HINTS);
  const shown = hints.slice(0, used);
  return (
    <div className="flex flex-col gap-2">
      {shown.length > 0 && (
        <ol className="flex flex-col gap-2">
          {shown.map((hint, index) => (
            <li
              key={hint}
              className="flex animate-pop gap-3 rounded-2xl bg-papa-100/80 px-4 py-3 text-sm text-papa-900 ring-1 ring-papa-200"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-papa-400 font-display text-xs font-bold text-white">
                {index + 1}
              </span>
              <Markdown className="pt-0.5">{hint}</Markdown>
            </li>
          ))}
        </ol>
      )}
      {canAsk && used < total && (
        <button
          type="button"
          onClick={onAsk}
          className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-extrabold transition ${
            highlight
              ? "animate-wiggle bg-papa-400 text-white shadow-md shadow-papa-400/40 hover:bg-papa-500"
              : "bg-papa-100 text-papa-800 hover:bg-papa-200"
          }`}
        >
          <Lightbulb className="size-4" aria-hidden />
          {used === 0 ? "Dame una pista" : "Otra pista"} ({used}/{total})
          <span className="font-semibold opacity-80">· resta 25 %</span>
        </button>
      )}
    </div>
  );
}
