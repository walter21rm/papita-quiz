"use client";

import type { Attempt, Quiz } from "@/lib/types";

interface ProgressHeaderProps {
  quiz: Quiz;
  attempt: Attempt;
  index: number;
  onJump: (index: number) => void;
}

export function ProgressHeader({ quiz, attempt, index, onJump }: ProgressHeaderProps) {
  const total = Math.max(quiz.targetCount, quiz.questions.length);
  const earned = Object.values(attempt.answers).reduce((sum, answer) => sum + (answer.done ? answer.score : 0), 0);
  const answered = Object.values(attempt.answers).filter((answer) => answer.done).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-lg font-semibold text-papa-900">
          Pregunta {Math.min(index + 1, total)} <span className="text-papa-800/60">de {total}</span>
        </p>
        <p className="text-sm font-bold text-papa-700">
          {answered > 0 ? `Llevas ${Math.round((earned / answered) * 100)} % de aciertos` : "¡Tú puedes, papita!"}
        </p>
      </div>
      <div className="flex gap-1" role="list" aria-label="Progreso del quiz">
        {Array.from({ length: total }, (_, position) => {
          const question = quiz.questions[position];
          const answer = question ? attempt.answers[question.id] : undefined;
          let color = "bg-papa-100";
          if (answer?.done) {
            color =
              answer.verdict === "correct" ? "bg-brote-500" : answer.verdict === "partial" ? "bg-papa-400" : "bg-tomate-500";
          }
          const current = position === index;
          const reachable = Boolean(answer?.done) || current;
          return (
            <button
              key={position}
              type="button"
              role="listitem"
              disabled={!reachable || current}
              onClick={() => onJump(position)}
              aria-label={`Pregunta ${position + 1}`}
              aria-current={current ? "step" : undefined}
              className={`h-2.5 flex-1 rounded-full transition ${color} ${
                current ? "ring-2 ring-papa-500 ring-offset-2 ring-offset-crema" : ""
              } ${reachable && !current ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
            />
          );
        })}
      </div>
    </div>
  );
}
