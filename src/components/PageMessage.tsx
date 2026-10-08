import Link from "next/link";
import type { ReactNode } from "react";
import { PapitaMascot, type PapitaMood } from "./PapitaMascot";

export function PageLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-papa-800" aria-live="polite">
      <PapitaMascot mood="thinking" size={96} className="animate-float" />
      <p className="font-display text-lg">{label}</p>
    </div>
  );
}

export function PageMessage({
  title,
  children,
  mood = "oops",
}: {
  title: string;
  children?: ReactNode;
  mood?: PapitaMood;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
      <PapitaMascot mood={mood} size={120} />
      <h1 className="font-display text-2xl font-semibold text-papa-900">{title}</h1>
      {children}
      <Link
        href="/"
        className="rounded-full bg-papa-500 px-6 py-2.5 font-display font-semibold text-white transition hover:bg-papa-600"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
