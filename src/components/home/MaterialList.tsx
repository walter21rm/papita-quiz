"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { deleteMaterial } from "@/lib/repo";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

export function MaterialList() {
  const items = useLiveQuery(async () => {
    const [materials, quizzes, attempts] = await Promise.all([
      db.materials.orderBy("updatedAt").reverse().toArray(),
      db.quizzes.toArray(),
      db.attempts.toArray(),
    ]);
    return materials.map((material) => {
      const finished = attempts
        .filter((attempt) => attempt.materialId === material.id && attempt.finishedAt)
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
      return {
        material,
        quizCount: quizzes.filter((quiz) => quiz.materialId === material.id).length,
        lastGrade: finished[0]?.grade20,
        bestGrade: finished.reduce<number | undefined>(
          (best, attempt) => Math.max(best ?? 0, attempt.grade20 ?? 0),
          undefined,
        ),
      };
    });
  });

  if (!items || items.length === 0) return null;

  return (
    <section id="materiales" className="flex scroll-mt-6 flex-col gap-4">
      <h2 className="font-display text-2xl font-semibold text-papa-900">Tus materiales</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(({ material, quizCount, lastGrade, bestGrade }) => (
          <li key={material.id} className="group relative">
            <Link
              href={`/material/${material.id}`}
              className="flex h-full items-start gap-3 rounded-3xl border border-papa-100 bg-white/85 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-papa-300 hover:shadow-md"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-papa-100 text-papa-600">
                <BookOpen className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pr-8">
                <p className="font-display text-lg leading-tight font-semibold text-papa-900">{material.title}</p>
                <p className="mt-1 text-xs text-papa-800/75">
                  {material.files.length} {material.files.length === 1 ? "archivo" : "archivos"} ·{" "}
                  {material.analysis.topics.length} temas · {formatDate(material.updatedAt)}
                </p>
                <p className="mt-2 text-sm text-papa-800">
                  {quizCount === 0
                    ? "Aún no has hecho quizzes"
                    : `${quizCount} ${quizCount === 1 ? "quiz" : "quizzes"}`}
                  {lastGrade !== undefined && (
                    <>
                      {" "}
                      · última nota <strong>{lastGrade}/20</strong>
                      {bestGrade !== undefined && bestGrade !== lastGrade && <> · mejor {bestGrade}/20</>}
                    </>
                  )}
                </p>
              </div>
              <ChevronRight className="mt-3 size-5 shrink-0 text-papa-400" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(`¿Eliminar "${material.title}" y todo su historial?`)) {
                  await deleteMaterial(material.id);
                }
              }}
              className="absolute top-3 right-10 rounded-full p-2 text-papa-800/50 opacity-0 transition group-hover:opacity-100 hover:bg-tomate-50 hover:text-tomate-600 focus-visible:opacity-100"
              aria-label={`Eliminar ${material.title}`}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
