import { db } from "./db";
import { answerKey } from "./dedupe";
import { createId } from "./fingerprint";
import type { PriorQuestion } from "./schemas";
import type {
  AnswerRecord,
  Attempt,
  CorpusPart,
  FileUpdate,
  Material,
  MaterialAnalysis,
  MaterialFile,
  Question,
  QuestionHistoryEntry,
  Quiz,
  QuizConfig,
} from "./types";

export async function findMaterialByFingerprint(fingerprint: string): Promise<Material | undefined> {
  return db.materials.where("fingerprint").equals(fingerprint).first();
}

export async function createMaterial(input: {
  fingerprint: string;
  files: MaterialFile[];
  corpus: CorpusPart[];
  analysis: MaterialAnalysis;
  notes: string[];
}): Promise<Material> {
  const now = Date.now();
  const material: Material = {
    id: createId(),
    fingerprint: input.fingerprint,
    title: input.analysis.title,
    files: input.files,
    analysis: input.analysis,
    processingNotes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.materials, db.corpora], async () => {
    await db.materials.add(material);
    await db.corpora.put({ materialId: material.id, parts: input.corpus });
  });
  return material;
}

export async function getCorpus(materialId: string): Promise<CorpusPart[] | undefined> {
  return (await db.corpora.get(materialId))?.parts;
}

export async function touchMaterial(id: string): Promise<void> {
  await db.materials.update(id, { updatedAt: Date.now() });
}

export async function renameMaterial(id: string, title: string): Promise<void> {
  await db.materials.update(id, { title: title.trim() || "Mi material", updatedAt: Date.now() });
}

export async function deleteMaterial(id: string): Promise<void> {
  await db.transaction("rw", [db.materials, db.corpora, db.questions, db.quizzes, db.attempts], async () => {
    await db.questions.where("materialId").equals(id).delete();
    await db.quizzes.where("materialId").equals(id).delete();
    await db.attempts.where("materialId").equals(id).delete();
    await db.corpora.delete(id);
    await db.materials.delete(id);
  });
}

export async function resetQuestionHistory(materialId: string): Promise<void> {
  await db.questions.where("materialId").equals(materialId).delete();
}

export async function applyFileUpdates(materialId: string, updates: FileUpdate[]): Promise<void> {
  if (updates.length === 0) return;
  const corpus = await db.corpora.get(materialId);
  if (!corpus) return;
  const parts = corpus.parts.map((part, index) => {
    const update = updates.find((item) => item.index === index);
    return update && part.kind === "media"
      ? { ...part, fileUri: update.fileUri, fileExpiresAt: update.fileExpiresAt }
      : part;
  });
  await db.corpora.put({ materialId, parts });
}

function historyEntryToPrior(entry: QuestionHistoryEntry): PriorQuestion {
  return { type: entry.type, prompt: entry.prompt, answer: entry.answer, conceptIds: entry.conceptIds };
}

export function questionToPrior(question: Question): PriorQuestion {
  return { type: question.type, prompt: question.prompt, answer: answerKey(question), conceptIds: question.conceptIds };
}

export async function getPriorQuestions(materialId: string, excludeQuizId?: string): Promise<PriorQuestion[]> {
  const entries = await db.questions.where("materialId").equals(materialId).sortBy("createdAt");
  return entries.filter((entry) => entry.quizId !== excludeQuizId).map(historyEntryToPrior);
}

export async function createQuiz(materialId: string, config: QuizConfig): Promise<Quiz> {
  const quiz: Quiz = {
    id: createId(),
    materialId,
    config,
    questions: [],
    targetCount: config.count,
    status: "generating",
    exhausted: false,
    createdAt: Date.now(),
  };
  await db.quizzes.add(quiz);
  await touchMaterial(materialId);
  return quiz;
}

export async function appendQuestions(quizId: string, questions: Question[], exhausted: boolean): Promise<void> {
  await db.transaction("rw", [db.quizzes, db.questions], async () => {
    const quiz = await db.quizzes.get(quizId);
    if (!quiz) return;
    const all = [...quiz.questions, ...questions];
    const done = exhausted || all.length >= quiz.targetCount;
    await db.quizzes.update(quizId, {
      questions: all,
      status: done ? "ready" : "generating",
      targetCount: exhausted ? all.length : quiz.targetCount,
      exhausted: quiz.exhausted || exhausted,
      error: undefined,
    });
    const now = Date.now();
    await db.questions.bulkAdd(
      questions.map((question, index) => ({
        id: question.id,
        materialId: quiz.materialId,
        quizId,
        level: question.level,
        type: question.type,
        prompt: question.prompt,
        answer: answerKey(question),
        conceptIds: question.conceptIds,
        createdAt: now + index,
      })),
    );
  });
}

export async function setQuizError(quizId: string, message: string): Promise<void> {
  await db.quizzes.update(quizId, { status: "error", error: message });
}

export async function retryQuiz(quizId: string): Promise<void> {
  await db.quizzes.update(quizId, { status: "generating", error: undefined });
}

/** Ends generation early, keeping the questions that already exist. */
export async function stopQuizGeneration(quizId: string): Promise<void> {
  const quiz = await db.quizzes.get(quizId);
  if (!quiz || quiz.questions.length === 0) return;
  await db.quizzes.update(quizId, { status: "ready", targetCount: quiz.questions.length, error: undefined });
}

export async function getOrCreateAttempt(quiz: Quiz): Promise<Attempt> {
  const existing = await db.attempts.get(quiz.id);
  if (existing) return existing;
  const attempt: Attempt = {
    id: quiz.id,
    quizId: quiz.id,
    materialId: quiz.materialId,
    answers: {},
    currentIndex: 0,
    startedAt: Date.now(),
  };
  await db.attempts.put(attempt);
  return attempt;
}

export async function saveAnswer(quizId: string, record: AnswerRecord): Promise<void> {
  await db.attempts.where("id").equals(quizId).modify((attempt) => {
    attempt.answers[record.questionId] = record;
  });
}

export async function setCurrentIndex(quizId: string, index: number): Promise<void> {
  await db.attempts.update(quizId, { currentIndex: index });
}

export async function finishAttempt(quizId: string, score: number, grade20: number): Promise<void> {
  await db.attempts.update(quizId, { finishedAt: Date.now(), score, grade20 });
}
