import Link from "next/link";
import { PapitaMascot } from "./PapitaMascot";

export function AppHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-4">
      <Link href="/" className="group flex min-w-0 items-center gap-2 rounded-2xl pr-2 focus-visible:outline-2 focus-visible:outline-papa-500">
        <PapitaMascot size={44} className="shrink-0 transition-transform group-hover:-rotate-6" />
        <span className="font-display text-lg font-semibold tracking-tight text-papa-900 sm:text-xl">
          Papita <span className="text-papa-500">Quiz</span>
        </span>
      </Link>
      <Link
        href="/#materiales"
        className="shrink-0 rounded-full px-3 py-2 text-sm font-bold text-papa-800 transition hover:bg-papa-100 sm:px-4"
      >
        Mis materiales
      </Link>
    </header>
  );
}
