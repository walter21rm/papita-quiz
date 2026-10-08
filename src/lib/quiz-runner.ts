import { ClientApiError, requestQuestions } from "./api-client";
import { db } from "./db";
import {
  appendQuestions,
  applyFileUpdates,
  getCorpus,
  getPriorQuestions,
  questionToPrior,
  setQuizError,
  stopQuizGeneration,
} from "./repo";

// Free-tier quotas are counted per request: short quizzes come in one call, long ones in two
// (a quick first batch so the student can start, then the rest).
const SINGLE_CALL_MAX = 10;
const FIRST_BATCH = 5;
const MAX_CALLS_PER_RUN = 4;

// Generation lives outside React so it keeps going while the quiz page is hidden or remounted;
// pages observe progress through IndexedDB.
const running = new Map<string, Promise<void>>();

async function generate(quizId: string): Promise<void> {
  for (let call = 0; ; call++) {
    if (call >= MAX_CALLS_PER_RUN) {
      await stopQuizGeneration(quizId);
      return;
    }
    const quiz = await db.quizzes.get(quizId);
    if (!quiz || quiz.status !== "generating") return;
    const material = await db.materials.get(quiz.materialId);
    const corpus = await getCorpus(quiz.materialId);
    if (!material || !corpus) {
      await setQuizError(quizId, "No encontré el material de este quiz.");
      return;
    }

    const remaining = quiz.targetCount - quiz.questions.length;
    if (remaining <= 0) {
      await db.quizzes.update(quizId, { status: "ready" });
      return;
    }
    const firstCall = quiz.questions.length === 0;
    const count = firstCall && remaining > SINGLE_CALL_MAX ? FIRST_BATCH : remaining;

    try {
      const history = await getPriorQuestions(material.id, quiz.id);
      const result = await requestQuestions({
        corpus,
        knowledge: {
          title: material.analysis.title,
          language: material.analysis.language,
          topics: material.analysis.topics,
        },
        config: quiz.config,
        count,
        existing: quiz.questions.map(questionToPrior),
        history,
      });
      await applyFileUpdates(material.id, result.fileUpdates);
      await appendQuestions(quizId, result.questions, result.exhausted);
      if (result.exhausted) return;
    } catch (error) {
      const message =
        error instanceof ClientApiError ? error.message : "No pude generar las preguntas. Vuelve a intentarlo.";
      await setQuizError(quizId, message);
      return;
    }
  }
}

export function ensureQuizGeneration(quizId: string): Promise<void> {
  const current = running.get(quizId);
  if (current) return current;
  const task = generate(quizId).finally(() => running.delete(quizId));
  running.set(quizId, task);
  return task;
}
