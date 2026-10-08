import { ChevronDown, Star } from "lucide-react";
import type { Topic } from "@/lib/types";

export function TopicsPanel({ topics }: { topics: Topic[] }) {
  const conceptCount = topics.reduce((sum, topic) => sum + topic.concepts.length, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-papa-800/80">
        Encontré {topics.length} {topics.length === 1 ? "tema" : "temas"} y {conceptCount} conceptos para preguntarte.
      </p>
      <ul className="flex flex-col gap-2">
        {topics.map((topic) => (
          <li key={topic.id}>
            <details className="group rounded-2xl border border-papa-100 bg-white/90 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-papa-900">{topic.name}</p>
                  {topic.description && <p className="mt-0.5 text-xs text-papa-800/80">{topic.description}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-0.5 pt-1" aria-label={`Importancia ${topic.importance} de 3`}>
                  {[1, 2, 3].map((value) => (
                    <Star
                      key={value}
                      className={`size-3.5 ${value <= topic.importance ? "fill-papa-400 text-papa-400" : "text-papa-200"}`}
                      aria-hidden
                    />
                  ))}
                </span>
                <ChevronDown className="mt-1 size-4 shrink-0 text-papa-500 transition group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="flex flex-col gap-2 border-t border-papa-100 px-4 py-3">
                {topic.concepts.map((concept) => (
                  <li key={concept.id} className="text-sm">
                    <p className="font-bold text-papa-900">{concept.name}</p>
                    {concept.explanation && <p className="text-papa-800">{concept.explanation}</p>}
                    {concept.source && <p className="text-xs text-papa-800/60">{concept.source}</p>}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
