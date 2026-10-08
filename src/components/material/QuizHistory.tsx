import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LEVEL_INFO } from "@/lib/labels";
import type { Attempt, Quiz } from "@/lib/types";

function gradeStyle(grade: number): string {
  if (grade >= 17) return "bg-brote-100 text-brote-700";
  if (grade >= 11) return "bg-papa-100 text-papa-800";
  return "bg-tomate-100 text-tomate-700";
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("es-PE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function QuizHistory({ quizzes, attempts }: { quizzes: Quiz[]; attempts: Attempt[] }) {
  if (quizzes.length === 0) {
    return <p className="text-sm text-papa-800/80">Todavía no has hecho ningún quiz con este material.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {quizzes.map((quiz) => {
        const attempt = attempts.find((item) => item.quizId === quiz.id);
        const answered = attempt ? Object.values(attempt.answers).filter((answer) => answer.done).length : 0;
        let status: ReactNode;
        if (attempt?.finishedAt !== undefined && attempt.grade20 !== undefined) {
          status = (
            <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${gradeStyle(attempt.grade20)}`}>
              {attempt.grade20}/20
            </span>
          );
        } else if (quiz.status === "error" && quiz.questions.length === 0) {
          status = <span className="text-sm font-bold text-tomate-600">Con error</span>;
        } else if (answered > 0) {
          status = (
            <span className="text-sm font-bold text-papa-700">
              En curso · {answered}/{quiz.targetCount}
            </span>
          );
        } else {
          status = (
            <span className="text-sm font-bold text-papa-700">
              {quiz.status === "generating" ? "Preparando…" : "Sin empezar"}
            </span>
          );
        }

        return (
          <li key={quiz.id}>
            <Link
              href={`/quiz/${quiz.id}`}
              className="flex items-center gap-3 rounded-2xl border border-papa-100 bg-white/90 px-4 py-3 transition hover:border-papa-300"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-papa-900">
                  {LEVEL_INFO[quiz.config.level].label} · {quiz.targetCount} preguntas
                  {quiz.config.focusConceptIds.length > 0 && (
                    <span className="ml-2 rounded-full bg-cielo-100 px-2 py-0.5 text-xs text-cielo-600">
                      Repaso de errores
                    </span>
                  )}
                </p>
                <p className="text-xs text-papa-800/70">{formatDateTime(quiz.createdAt)}</p>
              </div>
              {status}
              <ChevronRight className="size-4 shrink-0 text-papa-400" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
