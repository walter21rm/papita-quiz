import { ensureQuizGeneration } from "./quiz-runner";
import { createQuiz } from "./repo";
import { QUESTION_TYPES, type QuizConfig } from "./types";

export function defaultQuizConfig(): QuizConfig {
  return {
    level: "intermedio",
    count: 10,
    types: [...QUESTION_TYPES],
    topicIds: [],
    language: "es",
    focusConceptIds: [],
  };
}

/** Creates the quiz and starts generating its questions in the background. Returns the quiz id. */
export async function startQuiz(materialId: string, config: QuizConfig): Promise<string> {
  const quiz = await createQuiz(materialId, config);
  void ensureQuizGeneration(quiz.id);
  return quiz.id;
}
