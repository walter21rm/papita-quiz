import Link from "next/link";
import { PapitaMascot } from "./PapitaMascot";

export function AppHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
      <Link href="/" className="group flex items-center gap-2 rounded-2xl pr-3 focus-visible:outline-2 focus-visible:outline-papa-500">
        <PapitaMascot size={44} className="transition-transform group-hover:-rotate-6" />
        <span className="font-display text-xl font-semibold tracking-tight text-papa-900">
          Papita <span className="text-papa-500">Quiz</span>
        </span>
      </Link>
      <Link
        href="/#materiales"
        className="rounded-full px-4 py-2 text-sm font-bold text-papa-800 transition hover:bg-papa-100"
      >
        Mis materiales
      </Link>
    </header>
  );
}
