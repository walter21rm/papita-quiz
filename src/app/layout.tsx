import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Papita Quiz",
  description: "Sube tus documentos y practica con quizzes hechos a tu medida.",
};

export const viewport: Viewport = {
  themeColor: "#fff8ec",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col pb-16 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
          {children}
        </main>
        <footer className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-xs text-papa-800/70">
          Tus materiales y resultados se guardan solo en este navegador.
        </footer>
      </body>
    </html>
  );
}
