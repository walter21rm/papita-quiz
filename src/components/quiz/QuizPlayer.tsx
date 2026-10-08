"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { PageLoading, PageMessage } from "@/components/PageMessage";
import { db } from "@/lib/db";
import { summarize } from "@/lib/grading";
import { ensureQuizGeneration } from "@/lib/quiz-runner";
import { finishAttempt, getOrCreateAttempt, retryQuiz, setCurrentIndex, stopQuizGeneration } from "@/lib/repo";
import { GenerationError, PreparingQuestions } from "./GenerationStates";
import { ProgressHeader } from "./ProgressHeader";
import { QuestionStage } from "./QuestionStage";
import { ResultsView } from "./ResultsView";

async function finishQuiz(quizId: string) {
  const [quiz, attempt] = await Promise.all([db.quizzes.get(quizId), db.attempts.get(quizId)]);
  if (!quiz || !attempt) return;
  const answered = quiz.questions.filter((question) => attempt.answers[question.id]?.done);
  const summary = summarize(answered, attempt.answers);
  await finishAttempt(quizId, summary.score, summary.grade20);
}

export function QuizPlayer({ id }: { id: string }) {
  const quiz = useLiveQuery(async () => (await db.quizzes.get(id)) ?? null, [id]);
  const attempt = useLiveQuery(async () => (await db.attempts.get(id)) ?? null, [id]);
  const materialId = quiz?.materialId;
  const material = useLiveQuery(
    async () => (materialId ? ((await db.materials.get(materialId)) ?? null) : undefined),
    [materialId],
  );

  const status = quiz?.status;
  useEffect(() => {
    if (status === "generating") void ensureQuizGeneration(id);
  }, [id, status]);

  useEffect(() => {
    if (quiz && attempt === null) void getOrCreateAttempt(quiz);
  }, [quiz, attempt]);

  if (quiz === undefined || attempt === undefined) return <PageLoading label="Abriendo tu quiz…" />;
  if (quiz === null) {
    return (
      <PageMessage title="No encontré este quiz">
        <p className="max-w-md text-papa-800">Puede que lo hayas eliminado junto con su material.</p>
      </PageMessage>
    );
  }
  if (attempt === null) return <PageLoading label="Abriendo tu quiz…" />;

  const backLink = (
    <Link
      href={`/material/${quiz.materialId}`}
      className="inline-flex items-center gap-1 self-start text-sm font-bold text-papa-700 hover:text-papa-900"
    >
      <ArrowLeft className="size-4" aria-hidden /> {material?.title ?? "Volver al material"}
    </Link>
  );

  if (attempt.finishedAt) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        {backLink}
        <ResultsView quiz={quiz} attempt={attempt} material={material} />
      </div>
    );
  }

  const index = attempt.currentIndex;
  const question = quiz.questions[index];
  const answered = Object.values(attempt.answers).filter((answer) => answer.done).length;
  const moreComing = quiz.status === "generating";
  const isLast = quiz.status === "ready" && index + 1 >= quiz.questions.length;

  async function goNext() {
    const nextIndex = index + 1;
    const latest = await db.quizzes.get(id);
    if (!latest) return;
    if (nextIndex < latest.questions.length || latest.status !== "ready") {
      await setCurrentIndex(id, nextIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    await finishQuiz(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let body;
  if (question) {
    body = (
      <QuestionStage
        key={question.id}
        quiz={quiz}
        attempt={attempt}
        question={question}
        isLast={isLast}
        onNext={goNext}
      />
    );
  } else if (quiz.status === "error") {
    body = (
      <GenerationError
        message={quiz.error ?? "Algo salió mal."}
        materialId={quiz.materialId}
        answered={answered}
        onRetry={async () => {
          await retryQuiz(id);
          void ensureQuizGeneration(id);
        }}
        onFinish={async () => {
          await stopQuizGeneration(id);
          await finishQuiz(id);
        }}
      />
    );
  } else if (moreComing) {
    body = <PreparingQuestions first={quiz.questions.length === 0} />;
  } else {
    body = (
      <div className="flex justify-center py-10">
        <button
          type="button"
          onClick={() => finishQuiz(id)}
          className="rounded-full bg-papa-500 px-6 py-3 font-display text-lg font-semibold text-white transition hover:bg-papa-600"
        >
          Ver mis resultados
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      {backLink}
      {quiz.questions.length > 0 && (
        <ProgressHeader quiz={quiz} attempt={attempt} index={index} onJump={(position) => setCurrentIndex(id, position)} />
      )}
      {quiz.status === "error" && question && (
        <p className="flex items-center gap-2 rounded-2xl bg-tomate-50 px-4 py-2 text-sm text-tomate-700">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          No pude preparar las siguientes preguntas. Puedes seguir con estas y reintentar al final.
        </p>
      )}
      {body}
    </div>
  );
}
