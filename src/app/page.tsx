import { Lightbulb, ListChecks, Upload } from "lucide-react";
import { MaterialList } from "@/components/home/MaterialList";
import { UploadDropzone } from "@/components/home/UploadDropzone";
import { PapitaMascot } from "@/components/PapitaMascot";

const STEPS = [
  {
    icon: Upload,
    title: "Sube tu material",
    text: "Word, PowerPoint, PDF, Excel o fotos de tus apuntes. Leo texto, tablas, diagramas y hasta letra a mano.",
  },
  {
    icon: ListChecks,
    title: "Elige tu nivel",
    text: "Básico, intermedio, avanzado o experto, con preguntas para marcar, escribir, unir y ordenar.",
  },
  {
    icon: Lightbulb,
    title: "Practica con pistas",
    text: "Si te trabas te doy pistas, y cada vez que repitas el quiz las preguntas serán nuevas.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 pt-4">
      <section className="flex flex-col items-center gap-6 text-center">
        <PapitaMascot mood="wave" size={170} className="animate-float drop-shadow-xl" title="Papita saludando" />
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-4xl font-bold tracking-tight text-papa-900 sm:text-6xl">
            ¡Hola papita, <span className="text-papa-500">te ayudaré!</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-papa-800">
            Sube tus apuntes, diapositivas, PDF o fotos y te preparo un quiz a tu medida, con pistas cuando las
            necesites y sin repetir preguntas.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-2xl">
        <UploadDropzone />
      </section>

      <MaterialList />

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <article key={title} className="rounded-3xl bg-white/70 p-5 ring-1 ring-papa-100">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-papa-500 font-display text-lg font-bold text-white">
                {index + 1}
              </span>
              <Icon className="size-5 text-papa-600" aria-hidden />
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold text-papa-900">{title}</h3>
            <p className="mt-1 text-sm text-papa-800">{text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
