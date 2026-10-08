import { BookOpen, CircleCheck, CircleX, Flag, Sparkles } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { PapitaMascot } from "@/components/PapitaMascot";
import type { AnswerRecord, Question } from "@/lib/types";

export function FeedbackCard({ question, record }: { question: Question; record: AnswerRecord }) {
  const percent = Math.round(record.score * 100);
  let tone = "bg-tomate-50 ring-tomate-100";
  let title = "Esta vez no fue, pero ya la aprendiste";
  let Icon = CircleX;
  let iconColor = "text-tomate-600";
  let mood: "cheer" | "happy" | "oops" = "oops";
  if (record.gaveUp) {
    title = "No pasa nada, aquí tienes la respuesta";
    Icon = Flag;
  } else if (record.verdict === "correct") {
    tone = "bg-brote-50 ring-brote-100";
    title = record.hintsUsed > 0 || record.checks > 1 ? "¡Bien hecho, papita!" : "¡Excelente, papita!";
    Icon = CircleCheck;
    iconColor = "text-brote-600";
    mood = "cheer";
  } else if (record.verdict === "partial") {
    tone = "bg-papa-100/70 ring-papa-200";
    title = "¡Casi! Vas por buen camino";
    Icon = Sparkles;
    iconColor = "text-papa-600";
    mood = "happy";
  }

  const helps: string[] = [];
  if (record.hintsUsed > 0) helps.push(`${record.hintsUsed} ${record.hintsUsed === 1 ? "pista" : "pistas"}`);
  if (record.checks > 1) helps.push("2 intentos");

  return (
    <section className={`flex animate-pop flex-col gap-3 rounded-3xl p-5 ring-1 ${tone}`} aria-live="polite">
      <div className="flex items-center gap-3">
        <PapitaMascot mood={mood} size={64} className="shrink-0" />
        <div>
          <p className="flex items-center gap-2 font-display text-xl font-semibold text-papa-900">
            <Icon className={`size-5 ${iconColor}`} aria-hidden /> {title}
          </p>
          <p className="text-sm text-papa-800">
            Ganaste {percent} % de esta pregunta{helps.length > 0 ? ` (usaste ${helps.join(" y ")})` : ""}.
          </p>
        </div>
      </div>
      {record.feedback && <Markdown className="text-papa-900">{record.feedback}</Markdown>}
      {question.explanation && (
        <div className="rounded-2xl bg-white/80 px-4 py-3 text-papa-900">
          <p className="mb-1 text-xs font-extrabold tracking-wide text-papa-600 uppercase">Por qué</p>
          <Markdown>{question.explanation}</Markdown>
        </div>
      )}
      {question.source && (
        <p className="flex items-center gap-2 text-xs text-papa-800/80">
          <BookOpen className="size-3.5 shrink-0" aria-hidden /> Fuente: {question.source}
        </p>
      )}
    </section>
  );
}
