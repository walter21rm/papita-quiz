"use client";

import { ArrowRight, Flag, LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { QuestionInput } from "@/components/questions/QuestionInput";
import { ClientApiError, requestGrade } from "@/lib/api-client";
import {
  applyPenalty,
  emptyResponse,
  gradeLocally,
  gradeOffline,
  isAnswered,
  MAX_CHECKS,
  MAX_HINTS,
} from "@/lib/grading";
import { LEVEL_INFO, QUESTION_TYPE_INFO } from "@/lib/labels";
import { saveAnswer } from "@/lib/repo";
import type { AnswerRecord, Attempt, Question, Quiz, UserResponse } from "@/lib/types";
import { FeedbackCard } from "./FeedbackCard";
import { HintPanel } from "./HintPanel";

interface QuestionStageProps {
  quiz: Quiz;
  attempt: Attempt;
  question: Question;
  isLast: boolean;
  onNext: () => void;
}

function retryMessage(question: Question, record: AnswerRecord): string | null {
  if (record.feedback) return record.feedback;
  const response = record.response;
  if (response.type === "multiple_choice" && record.verdict === "partial") {
    return "Tienes algunas bien, pero te faltan o te sobran opciones.";
  }
  if (response.type === "matching") {
    const right = response.matches.filter((match, index) => match === index).length;
    return `Tienes ${right} de ${question.pairs?.length ?? 0} parejas bien. Revisa las demás.`;
  }
  if (response.type === "ordering") return "Algunos elementos están fuera de lugar.";
  if (response.type === "fill_blank") return "Revisa los espacios marcados en rojo.";
  return null;
}

export function QuestionStage({ quiz, attempt, question, isLast, onNext }: QuestionStageProps) {
  const saved = attempt.answers[question.id];
  const [response, setResponse] = useState<UserResponse>(() => saved?.response ?? emptyResponse(question));
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hintsUsed = saved?.hintsUsed ?? 0;
  const checks = saved?.checks ?? 0;
  const done = saved?.done ?? false;
  const retrying = !done && checks > 0 && saved !== undefined;
  const info = QUESTION_TYPE_INFO[question.type];
  const maxHints = Math.min(MAX_HINTS, question.hints.length);
  const retryText = retrying && saved ? retryMessage(question, saved) : null;

  function baseRecord(): AnswerRecord {
    return (
      saved ?? {
        questionId: question.id,
        response,
        checks: 0,
        hintsUsed: 0,
        gaveUp: false,
        verdict: "incorrect",
        rawScore: 0,
        score: 0,
        done: false,
      }
    );
  }

  async function askHint() {
    if (done || hintsUsed >= maxHints) return;
    await saveAnswer(quiz.id, { ...baseRecord(), response, hintsUsed: hintsUsed + 1 });
  }

  async function check() {
    if (done || grading || !isAnswered(response)) return;
    setGrading(true);
    setError(null);
    try {
      const nextChecks = checks + 1;
      const final = nextChecks >= MAX_CHECKS;
      let result = gradeLocally(question, response);
      if (!result) {
        try {
          result = await requestGrade({ question, response, final });
        } catch (caught) {
          if (!(caught instanceof ClientApiError)) throw caught;
          result = {
            ...gradeOffline(question, response),
            feedback: `No pude corregir con la IA (${caught.message}) Te califiqué comparando con la respuesta esperada.`,
          };
        }
      }
      const score = applyPenalty(result.score, hintsUsed, nextChecks);
      const previousBest = saved?.score ?? 0;
      const improved = score >= previousBest;
      await saveAnswer(quiz.id, {
        questionId: question.id,
        response,
        checks: nextChecks,
        hintsUsed,
        gaveUp: false,
        verdict: improved ? result.verdict : (saved?.verdict ?? result.verdict),
        rawScore: improved ? result.score : (saved?.rawScore ?? result.score),
        score: Math.max(score, previousBest),
        feedback: result.feedback,
        blankResults: result.blankResults,
        done: result.verdict === "correct" || final,
      });
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "No pude revisar tu respuesta. Inténtalo otra vez.",
      );
    } finally {
      setGrading(false);
    }
  }

  async function giveUp() {
    const keptScore = saved?.score ?? 0;
    await saveAnswer(quiz.id, {
      ...baseRecord(),
      response,
      gaveUp: true,
      verdict: keptScore > 0 ? (saved?.verdict ?? "incorrect") : "incorrect",
      score: keptScore,
      feedback: undefined,
      done: true,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <article className="flex flex-col gap-5 rounded-[2rem] bg-white/90 p-5 shadow-sm ring-1 ring-papa-100 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-papa-500 px-3 py-1 text-xs font-extrabold text-white">{info.label}</span>
          <span className="rounded-full bg-papa-100 px-3 py-1 text-xs font-bold text-papa-700">
            {LEVEL_INFO[question.level].label}
          </span>
        </div>

        {question.type !== "fill_blank" && (
          <Markdown className="font-display text-xl leading-snug font-medium text-papa-900 sm:text-2xl">
            {question.prompt}
          </Markdown>
        )}
        <p className="-mt-2 text-sm font-semibold text-papa-700">{info.instruction}</p>

        <QuestionInput
          question={question}
          response={response}
          onChange={(next) => {
            setResponse(next);
            setError(null);
          }}
          review={done}
          disabled={grading}
          blankResults={saved?.blankResults}
          onSubmit={check}
        />

        {retrying && saved && (
          <div className="flex animate-pop gap-3 rounded-2xl bg-tomate-50 px-4 py-3 text-sm text-tomate-700 ring-1 ring-tomate-100" role="status">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-extrabold">
                {saved.verdict === "partial" ? "¡Casi! Te falta un poquito." : "Todavía no es correcta."}
              </p>
              {retryText && <Markdown className="text-papa-900">{retryText}</Markdown>}
              <p className="mt-1 font-semibold">Tienes un intento más. Si quieres, pide una pista.</p>
            </div>
          </div>
        )}

        {!done && (
          <HintPanel
            hints={question.hints}
            used={hintsUsed}
            canAsk={!grading}
            highlight={retrying}
            onAsk={askHint}
          />
        )}
        {done && hintsUsed > 0 && <HintPanel hints={question.hints} used={hintsUsed} canAsk={false} highlight={false} onAsk={askHint} />}

        {error && (
          <p role="alert" className="rounded-2xl bg-tomate-50 px-4 py-3 text-sm font-semibold text-tomate-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-papa-100 pt-4">
          {!done ? (
            <>
              <button
                type="button"
                onClick={check}
                disabled={grading || !isAnswered(response)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-papa-500 px-6 py-3 font-display text-lg font-semibold text-white shadow-md shadow-papa-500/30 transition hover:bg-papa-600 disabled:bg-papa-200 disabled:shadow-none sm:w-auto"
              >
                {grading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
                {grading ? "Revisando…" : retrying ? "Comprobar de nuevo" : "Comprobar"}
              </button>
              <button
                type="button"
                onClick={giveUp}
                disabled={grading}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-papa-700 transition hover:bg-papa-50"
              >
                <Flag className="size-4" aria-hidden /> Me rindo, muéstrame la respuesta
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onNext}
              autoFocus
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-papa-500 px-6 py-3 font-display text-lg font-semibold text-white shadow-md shadow-papa-500/30 transition hover:bg-papa-600 sm:w-auto"
            >
              {isLast ? "Ver mis resultados" : "Siguiente pregunta"} <ArrowRight className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </article>

      {done && saved && <FeedbackCard question={question} record={saved} />}
    </div>
  );
}
