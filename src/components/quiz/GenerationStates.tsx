"use client";

import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PapitaMascot } from "@/components/PapitaMascot";

const MESSAGES = [
  "Pensando preguntas que todavía no hayas visto…",
  "Revisando que cada respuesta esté en tu material…",
  "Escribiendo pistas por si te trabas…",
  "Mezclando preguntas para marcar, escribir y ordenar…",
  "Ya casi, papita…",
];

export function PreparingQuestions({ first }: { first: boolean }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % MESSAGES.length), 4500);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-col items-center gap-4 rounded-[2rem] bg-white/85 px-6 py-14 text-center ring-1 ring-papa-100">
      <PapitaMascot mood="thinking" size={130} className="animate-float" />
      <p className="font-display text-2xl font-semibold text-papa-900">
        {first ? "Preparando tu quiz" : "Preparando más preguntas"}
      </p>
      <p className="text-papa-800" aria-live="polite">
        {MESSAGES[index]}
      </p>
      <LoaderCircle className="size-6 animate-spin text-papa-500" aria-hidden />
    </div>
  );
}

interface GenerationErrorProps {
  message: string;
  materialId: string;
  answered: number;
  onRetry: () => void;
  onFinish: () => void;
}

export function GenerationError({ message, materialId, answered, onRetry, onFinish }: GenerationErrorProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[2rem] bg-white/85 px-6 py-12 text-center ring-1 ring-tomate-100">
      <PapitaMascot mood="oops" size={110} />
      <p className="flex items-center gap-2 font-display text-2xl font-semibold text-papa-900">
        <TriangleAlert className="size-6 text-tomate-600" aria-hidden /> No pude preparar las preguntas
      </p>
      <p className="max-w-lg text-papa-800">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-papa-500 px-6 py-3 font-display font-semibold text-white transition hover:bg-papa-600"
        >
          <RefreshCw className="size-4" aria-hidden /> Reintentar
        </button>
        {answered > 0 ? (
          <button
            type="button"
            onClick={onFinish}
            className="rounded-full px-5 py-3 font-bold text-papa-800 ring-1 ring-papa-200 transition hover:bg-papa-50"
          >
            Terminar con las {answered} preguntas que respondí
          </button>
        ) : (
          <Link
            href={`/material/${materialId}`}
            className="rounded-full px-5 py-3 font-bold text-papa-800 ring-1 ring-papa-200 transition hover:bg-papa-50"
          >
            Volver al material
          </Link>
        )}
      </div>
    </div>
  );
}
