"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Info, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { Markdown } from "@/components/Markdown";
import { PageLoading, PageMessage } from "@/components/PageMessage";
import { db } from "@/lib/db";
import { clearFlashNotice, peekFlashNotice } from "@/lib/flash";
import { deleteMaterial, resetQuestionHistory } from "@/lib/repo";
import { startQuiz } from "@/lib/start-quiz";
import { LEVELS, type Level, type QuizConfig } from "@/lib/types";
import { QuizConfigForm } from "./QuizConfigForm";
import { QuizHistory } from "./QuizHistory";
import { TopicsPanel } from "./TopicsPanel";

export function MaterialView({ id }: { id: string }) {
  const router = useRouter();
  const [notice] = useState(peekFlashNotice);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    clearFlashNotice();
  }, []);

  const material = useLiveQuery(async () => (await db.materials.get(id)) ?? null, [id]);
  const data = useLiveQuery(async () => {
    const [history, quizzes, attempts] = await Promise.all([
      db.questions.where("materialId").equals(id).toArray(),
      db.quizzes.where("materialId").equals(id).toArray(),
      db.attempts.where("materialId").equals(id).toArray(),
    ]);
    const usedByLevel = Object.fromEntries(LEVELS.map((level) => [level, 0])) as Record<Level, number>;
    for (const entry of history) usedByLevel[entry.level]++;
    return {
      usedByLevel,
      totalAsked: history.length,
      quizzes: quizzes.sort((a, b) => b.createdAt - a.createdAt),
      attempts,
    };
  }, [id]);

  if (material === undefined || data === undefined) return <PageLoading label="Abriendo tu material…" />;
  if (material === null) {
    return (
      <PageMessage title="No encontré este material">
        <p className="max-w-md text-papa-800">Puede que lo hayas eliminado o que estés usando otro navegador.</p>
      </PageMessage>
    );
  }

  const { analysis } = material;
  const notes = [...analysis.warnings, ...material.processingNotes];

  async function handleCreate(config: QuizConfig) {
    setCreating(true);
    try {
      const quizId = await startQuiz(id, config);
      router.push(`/quiz/${quizId}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleResetHistory() {
    if (window.confirm("¿Reiniciar el historial? Las preguntas que ya viste podrán volver a salir.")) {
      await resetQuestionHistory(id);
    }
  }

  async function handleDelete() {
    if (window.confirm(`¿Eliminar "${material?.title}" junto con sus quizzes y resultados?`)) {
      await deleteMaterial(id);
      router.push("/");
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Link href="/" className="inline-flex items-center gap-1 self-start text-sm font-bold text-papa-700 hover:text-papa-900">
        <ArrowLeft className="size-4" aria-hidden /> Inicio
      </Link>

      {notice && (
        <p className="flex items-center gap-2 rounded-2xl bg-cielo-50 px-4 py-3 text-sm font-semibold text-cielo-600 ring-1 ring-cielo-100">
          <Info className="size-4 shrink-0" aria-hidden /> {notice}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-[2rem] bg-white/85 p-6 shadow-sm ring-1 ring-papa-100">
        {analysis.materialType && (
          <span className="self-start rounded-full bg-papa-100 px-3 py-1 text-xs font-extrabold tracking-wide text-papa-700 uppercase">
            {analysis.materialType}
          </span>
        )}
        <h1 className="font-display text-3xl font-bold text-papa-900">{material.title}</h1>
        <ul className="flex flex-wrap gap-2">
          {material.files.map((file) => (
            <li
              key={file.hash + file.name}
              className="flex items-center gap-2 rounded-full bg-papa-50 py-1 pr-3 pl-1 text-sm text-papa-800 ring-1 ring-papa-100"
            >
              <FileTypeIcon fileName={file.name} className="size-7 rounded-full" />
              <span className="max-w-56 truncate">{file.name}</span>
            </li>
          ))}
        </ul>
        {analysis.summary && <Markdown className="text-papa-900">{analysis.summary}</Markdown>}
        {notes.length > 0 && (
          <div className="flex gap-2 rounded-2xl bg-papa-100/70 px-4 py-3 text-sm text-papa-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-papa-600" aria-hidden />
            <ul className="flex flex-col gap-1">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-[2rem] bg-white/85 p-6 shadow-sm ring-1 ring-papa-100">
          <h2 className="mb-4 font-display text-2xl font-semibold text-papa-900">Arma tu quiz</h2>
          <QuizConfigForm
            material={material}
            usedByLevel={data.usedByLevel}
            creating={creating}
            onCreate={handleCreate}
            onResetHistory={handleResetHistory}
          />
        </section>

        <section className="rounded-[2rem] bg-white/85 p-6 shadow-sm ring-1 ring-papa-100">
          <h2 className="mb-4 font-display text-2xl font-semibold text-papa-900">Lo que encontré</h2>
          <TopicsPanel topics={analysis.topics} />
        </section>
      </div>

      <section className="rounded-[2rem] bg-white/85 p-6 shadow-sm ring-1 ring-papa-100">
        <h2 className="mb-1 font-display text-2xl font-semibold text-papa-900">Tus quizzes</h2>
        <p className="mb-4 text-sm text-papa-800/80">
          {data.totalAsked > 0
            ? `Ya te hice ${data.totalAsked} preguntas distintas con este material; no las repetiré.`
            : "Cada quiz nuevo tendrá preguntas distintas a las anteriores."}
        </p>
        <QuizHistory quizzes={data.quizzes} attempts={data.attempts} />
        <div className="mt-6 flex flex-wrap gap-2 border-t border-papa-100 pt-4">
          <button
            type="button"
            onClick={handleResetHistory}
            disabled={data.totalAsked === 0}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-papa-700 ring-1 ring-papa-200 transition hover:bg-papa-50 disabled:opacity-50"
          >
            <RotateCcw className="size-4" aria-hidden /> Reiniciar historial de preguntas
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-tomate-600 ring-1 ring-tomate-100 transition hover:bg-tomate-50"
          >
            <Trash2 className="size-4" aria-hidden /> Eliminar material
          </button>
        </div>
      </section>
    </div>
  );
}
