"use client";

import { ArrowLeft, ChevronDown, CircleCheck, CircleX, Info, Lightbulb, RefreshCw, Sparkles, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { PapitaMascot } from "@/components/PapitaMascot";
import { describeCorrectAnswer, describeUserAnswer } from "@/lib/describe";
import { summarize } from "@/lib/grading";
import { LEVEL_INFO, QUESTION_TYPE_INFO } from "@/lib/labels";
import { startQuiz } from "@/lib/start-quiz";
import { LEVELS, type Attempt, type Material, type Quiz, type QuizConfig } from "@/lib/types";

interface ResultsViewProps {
  quiz: Quiz;
  attempt: Attempt;
  material: Material | null | undefined;
}

function headline(grade: number): { title: string; text: string; mood: "cheer" | "happy" | "oops" } {
  if (grade >= 17) return { title: "¡Eres una papita brillante!", text: "Dominas este material. ¿Subimos de nivel?", mood: "cheer" };
  if (grade >= 14) return { title: "¡Muy bien, papita!", text: "Vas muy bien. Repasa los detalles y quedará perfecto.", mood: "cheer" };
  if (grade >= 11) return { title: "¡Aprobaste, papita!", text: "Ya tienes la base. Practica tus errores para afianzar.", mood: "happy" };
  return { title: "¡Ánimo, papita!", text: "Cada error es una pista de qué repasar. Practiquemos lo que falló.", mood: "oops" };
}

export function ResultsView({ quiz, attempt, material }: ResultsViewProps) {
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);
  const summary = useMemo(() => summarize(quiz.questions, attempt.answers), [quiz.questions, attempt.answers]);
  const grade = attempt.grade20 ?? summary.grade20;
  const message = headline(grade);

  useEffect(() => {
    if (grade < 14) return;
    let cancelled = false;
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      confetti({ particleCount: 140, spread: 75, origin: { y: 0.3 }, colors: ["#eda93b", "#4f9d48", "#f6c25f", "#d9573f"] });
    });
    return () => {
      cancelled = true;
    };
  }, [grade]);

  const topicStats = useMemo(() => {
    const topicByConcept = new Map<string, string>();
    for (const topic of material?.analysis.topics ?? []) {
      for (const concept of topic.concepts) topicByConcept.set(concept.id, topic.name);
    }
    const stats = new Map<string, { total: number; count: number }>();
    for (const question of quiz.questions) {
      const score = attempt.answers[question.id]?.score ?? 0;
      const names = [...new Set(question.conceptIds.map((id) => topicByConcept.get(id)).filter(Boolean))] as string[];
      for (const name of names.length ? names : ["Otros"]) {
        const entry = stats.get(name) ?? { total: 0, count: 0 };
        entry.total += score;
        entry.count++;
        stats.set(name, entry);
      }
    }
    return [...stats.entries()]
      .map(([name, entry]) => ({ name, percent: Math.round((entry.total / entry.count) * 100), count: entry.count }))
      .sort((a, b) => a.percent - b.percent);
  }, [attempt.answers, material, quiz.questions]);

  const missedConcepts = [
    ...new Set(
      quiz.questions
        .filter((question) => attempt.answers[question.id]?.verdict !== "correct")
        .flatMap((question) => question.conceptIds),
    ),
  ];
  const missedCount = quiz.questions.filter((question) => attempt.answers[question.id]?.verdict !== "correct").length;
  const nextLevel = LEVELS[LEVELS.indexOf(quiz.config.level) + 1];

  async function launch(key: string, config: QuizConfig) {
    setStarting(key);
    try {
      const quizId = await startQuiz(quiz.materialId, config);
      router.push(`/quiz/${quizId}`);
    } finally {
      setStarting(null);
    }
  }

  const baseConfig: QuizConfig = { ...quiz.config, focusConceptIds: [] };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-4 rounded-[2rem] bg-white/90 px-6 py-10 text-center shadow-sm ring-1 ring-papa-100">
        <PapitaMascot mood={message.mood} size={140} className="animate-float" />
        <div>
          <p className="font-display text-7xl font-bold text-papa-900">
            {grade}
            <span className="text-3xl text-papa-800/60">/20</span>
          </p>
          <p className="mt-1 font-bold text-papa-700">{Math.round(summary.score * 100)} % de aciertos</p>
        </div>
        <h1 className="font-display text-3xl font-semibold text-papa-900">{message.title}</h1>
        <p className="max-w-lg text-papa-800">{message.text}</p>
        <div className="flex flex-wrap justify-center gap-2 text-sm font-bold">
          <span className="rounded-full bg-brote-100 px-3 py-1 text-brote-700">{summary.correct} correctas</span>
          <span className="rounded-full bg-papa-100 px-3 py-1 text-papa-800">{summary.partial} parciales</span>
          <span className="rounded-full bg-tomate-100 px-3 py-1 text-tomate-700">{summary.incorrect} incorrectas</span>
          <span className="rounded-full bg-cielo-100 px-3 py-1 text-cielo-600">
            {summary.hintsUsed} {summary.hintsUsed === 1 ? "pista" : "pistas"}
          </span>
        </div>
      </section>

      {quiz.exhausted && (
        <p className="flex gap-2 rounded-2xl bg-cielo-50 px-4 py-3 text-sm text-cielo-600 ring-1 ring-cielo-100">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Ya casi no quedan preguntas nuevas de este nivel con este material, por eso el quiz salió más corto. Prueba
          otro nivel, otros temas o reinicia el historial desde la página del material.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={starting !== null}
          onClick={() => launch("again", baseConfig)}
          className="flex items-center gap-3 rounded-3xl bg-papa-500 px-5 py-4 text-left text-white shadow-md shadow-papa-500/30 transition hover:bg-papa-600 disabled:opacity-60"
        >
          <RefreshCw className={`size-6 shrink-0 ${starting === "again" ? "animate-spin" : ""}`} aria-hidden />
          <span>
            <span className="block font-display text-lg font-semibold">Otro quiz con preguntas nuevas</span>
            <span className="text-sm opacity-90">Mismo nivel, sin repetir lo que ya viste</span>
          </span>
        </button>
        {missedCount > 0 && missedConcepts.length > 0 && (
          <button
            type="button"
            disabled={starting !== null}
            onClick={() =>
              launch("errors", {
                ...quiz.config,
                topicIds: [],
                focusConceptIds: missedConcepts,
                count: Math.min(10, Math.max(5, missedCount * 2)),
              })
            }
            className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 text-left ring-2 ring-papa-300 transition hover:bg-papa-50 disabled:opacity-60"
          >
            <Target className={`size-6 shrink-0 text-papa-600 ${starting === "errors" ? "animate-pulse" : ""}`} aria-hidden />
            <span>
              <span className="block font-display text-lg font-semibold text-papa-900">Practicar mis errores</span>
              <span className="text-sm text-papa-800">Preguntas nuevas sobre lo que fallaste</span>
            </span>
          </button>
        )}
        {nextLevel && (
          <button
            type="button"
            disabled={starting !== null}
            onClick={() => launch("level", { ...baseConfig, level: nextLevel })}
            className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 text-left ring-1 ring-papa-200 transition hover:bg-papa-50 disabled:opacity-60"
          >
            <TrendingUp className="size-6 shrink-0 text-brote-600" aria-hidden />
            <span>
              <span className="block font-display text-lg font-semibold text-papa-900">
                Subir a nivel {LEVEL_INFO[nextLevel].label.toLowerCase()}
              </span>
              <span className="text-sm text-papa-800">{LEVEL_INFO[nextLevel].short}</span>
            </span>
          </button>
        )}
        <Link
          href={`/material/${quiz.materialId}`}
          className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 text-left ring-1 ring-papa-200 transition hover:bg-papa-50"
        >
          <ArrowLeft className="size-6 shrink-0 text-papa-600" aria-hidden />
          <span>
            <span className="block font-display text-lg font-semibold text-papa-900">Volver al material</span>
            <span className="text-sm text-papa-800">Cambiar nivel, temas o tipos de pregunta</span>
          </span>
        </Link>
      </section>

      {topicStats.length > 0 && (
        <section className="rounded-[2rem] bg-white/90 p-6 shadow-sm ring-1 ring-papa-100">
          <h2 className="mb-4 font-display text-2xl font-semibold text-papa-900">Cómo te fue por tema</h2>
          <ul className="flex flex-col gap-3">
            {topicStats.map((topic) => (
              <li key={topic.name}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-bold text-papa-900">{topic.name}</span>
                  <span className="font-bold text-papa-700">
                    {topic.percent} %{topic.percent < 60 && <span className="ml-2 text-tomate-600">· para repasar</span>}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-papa-100">
                  <div
                    className={`h-full rounded-full ${
                      topic.percent >= 80 ? "bg-brote-500" : topic.percent >= 60 ? "bg-papa-400" : "bg-tomate-500"
                    }`}
                    style={{ width: `${Math.max(topic.percent, 3)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[2rem] bg-white/90 p-6 shadow-sm ring-1 ring-papa-100">
        <h2 className="mb-4 font-display text-2xl font-semibold text-papa-900">Repaso de tus respuestas</h2>
        <ol className="flex flex-col gap-2">
          {quiz.questions.map((question, index) => {
            const answer = attempt.answers[question.id];
            const verdict = answer?.verdict ?? "incorrect";
            const Icon = verdict === "correct" ? CircleCheck : verdict === "partial" ? Sparkles : CircleX;
            const color =
              verdict === "correct" ? "text-brote-600" : verdict === "partial" ? "text-papa-500" : "text-tomate-600";
            return (
              <li key={question.id}>
                <details className="group rounded-2xl border border-papa-100 bg-white open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <Icon className={`mt-0.5 size-5 shrink-0 ${color}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-papa-600">
                        {index + 1}. {QUESTION_TYPE_INFO[question.type].label} · {Math.round((answer?.score ?? 0) * 100)} %
                        {answer?.hintsUsed ? (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-papa-500">
                            <Lightbulb className="size-3" aria-hidden /> {answer.hintsUsed}
                          </span>
                        ) : null}
                      </p>
                      <Markdown className="line-clamp-2 text-papa-900 group-open:line-clamp-none">
                        {question.prompt}
                      </Markdown>
                    </div>
                    <ChevronDown className="mt-1 size-4 shrink-0 text-papa-500 transition group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="flex flex-col gap-2 border-t border-papa-100 px-4 py-3 text-sm">
                    <p>
                      <span className="font-extrabold text-papa-700">Tu respuesta: </span>
                      <span className="whitespace-pre-line text-papa-900">
                        {answer?.gaveUp && !answer.checks ? "Te rendiste" : describeUserAnswer(question, answer?.response)}
                      </span>
                    </p>
                    <div>
                      <span className="font-extrabold text-brote-700">Respuesta correcta: </span>
                      <Markdown inline className="text-papa-900">
                        {describeCorrectAnswer(question)}
                      </Markdown>
                    </div>
                    {answer?.feedback && (
                      <p className="text-papa-800">
                        <span className="font-extrabold text-papa-700">Comentario: </span>
                        {answer.feedback}
                      </p>
                    )}
                    {question.explanation && (
                      <div className="rounded-xl bg-papa-50 px-3 py-2 text-papa-900">
                        <Markdown>{question.explanation}</Markdown>
                      </div>
                    )}
                    {question.source && <p className="text-xs text-papa-800/70">Fuente: {question.source}</p>}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
