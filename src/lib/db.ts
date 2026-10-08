import Dexie, { type EntityTable } from "dexie";
import type { Attempt, Material, MaterialCorpus, QuestionHistoryEntry, Quiz } from "./types";

class PapitaDatabase extends Dexie {
  materials!: EntityTable<Material, "id">;
  corpora!: EntityTable<MaterialCorpus, "materialId">;
  questions!: EntityTable<QuestionHistoryEntry, "id">;
  quizzes!: EntityTable<Quiz, "id">;
  attempts!: EntityTable<Attempt, "id">;

  constructor() {
    super("papita-quiz");
    this.version(1).stores({
      materials: "id, fingerprint, updatedAt",
      corpora: "materialId",
      questions: "id, materialId, quizId, createdAt",
      quizzes: "id, materialId, createdAt",
      attempts: "id, quizId, materialId, finishedAt",
    });
  }
}

export const db = new PapitaDatabase();
