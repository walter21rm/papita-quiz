"use client";

import { Check, LoaderCircle, Play, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LEVEL_INFO, QUESTION_GROUP_LABEL, QUESTION_TYPE_INFO, type QuestionGroup } from "@/lib/labels";
import { defaultQuizConfig } from "@/lib/start-quiz";
import { LEVELS, QUESTION_TYPES, type Level, type Material, type QuestionType, type QuizConfig } from "@/lib/types";

const COUNTS = [5, 10, 15, 20, 30];
const GROUPS: QuestionGroup[] = ["marcar", "escribir", "ordenar"];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "inglés",
  pt: "portugués",
  fr: "francés",
  it: "italiano",
  de: "alemán",
  qu: "quechua",
};

interface QuizConfigFormProps {
  material: Material;
  usedByLevel: Record<Level, number>;
  creating: boolean;
  onCreate: (config: QuizConfig) => void;
  onResetHistory: () => void;
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
        selected
          ? "bg-papa-500 text-white shadow-sm shadow-papa-500/30"
          : "bg-white text-papa-800 ring-1 ring-papa-200 hover:ring-papa-400"
      }`}
    >
      {selected && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

export function QuizConfigForm({ material, usedByLevel, creating, onCreate, onResetHistory }: QuizConfigFormProps) {
  const [config, setConfig] = useState<QuizConfig>(defaultQuizConfig);
  const materialLanguage = material.analysis.language;
  const foreign = !materialLanguage.startsWith("es");

  const capacity = material.analysis.capacity[config.level];
  const remaining = Math.max(0, capacity - usedByLevel[config.level]);

  function toggleType(type: QuestionType) {
    setConfig((current) => {
      const has = current.types.includes(type);
      if (has && current.types.length === 1) return current;
      const types = has ? current.types.filter((item) => item !== type) : [...current.types, type];
      return { ...current, types: QUESTION_TYPES.filter((item) => types.includes(item)) };
    });
  }

  function toggleTopic(topicId: string) {
    setConfig((current) => {
      const topicIds = current.topicIds.includes(topicId)
        ? current.topicIds.filter((item) => item !== topicId)
        : [...current.topicIds, topicId];
      return { ...current, topicIds: topicIds.length === material.analysis.topics.length ? [] : topicIds };
    });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(config);
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-lg font-semibold text-papa-900">1. ¿Qué nivel quieres?</legend>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {LEVELS.map((level) => {
            const info = LEVEL_INFO[level];
            const selected = config.level === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={selected}
                onClick={() => setConfig((current) => ({ ...current, level }))}
                className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition ${
                  selected
                    ? "border-papa-500 bg-papa-50 shadow-md shadow-papa-200/60"
                    : "border-papa-100 bg-white hover:border-papa-300"
                }`}
              >
                <span className="font-display text-base font-semibold text-papa-900">{info.label}</span>
                <span className="text-xs font-bold text-papa-600">{info.short}</span>
                <span className="text-xs text-papa-800/80">{info.description}</span>
              </button>
            );
          })}
        </div>
        <p className={`text-sm ${remaining < config.count ? "text-tomate-600" : "text-papa-800/80"}`}>
          {remaining > 0
            ? `Quedan aproximadamente ${remaining} preguntas nuevas en nivel ${LEVEL_INFO[config.level].label.toLowerCase()}.`
            : `Ya usaste casi todas las preguntas de este nivel.`}{" "}
          {remaining < config.count && (
            <button type="button" onClick={onResetHistory} className="font-bold underline underline-offset-2">
              Reiniciar historial
            </button>
          )}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-lg font-semibold text-papa-900">2. ¿Cuántas preguntas?</legend>
        <div className="flex flex-wrap gap-2">
          {COUNTS.map((count) => (
            <Chip
              key={count}
              selected={config.count === count}
              onClick={() => setConfig((current) => ({ ...current, count }))}
            >
              {count}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-lg font-semibold text-papa-900">3. Tipos de pregunta</legend>
        <div className="flex flex-col gap-3">
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <span className="text-xs font-extrabold tracking-wide text-papa-600 uppercase">
                {QUESTION_GROUP_LABEL[group]}
              </span>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPES.filter((type) => QUESTION_TYPE_INFO[type].group === group).map((type) => (
                  <Chip key={type} selected={config.types.includes(type)} onClick={() => toggleType(type)}>
                    {QUESTION_TYPE_INFO[type].label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        {config.types.length < QUESTION_TYPES.length && (
          <button
            type="button"
            onClick={() => setConfig((current) => ({ ...current, types: [...QUESTION_TYPES] }))}
            className="self-start text-sm font-bold text-papa-700 underline underline-offset-2"
          >
            Usar todos los tipos
          </button>
        )}
      </fieldset>

      {material.analysis.topics.length > 1 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-display text-lg font-semibold text-papa-900">4. ¿Sobre qué temas?</legend>
          <div className="flex flex-wrap gap-2">
            <Chip
              selected={config.topicIds.length === 0}
              onClick={() => setConfig((current) => ({ ...current, topicIds: [] }))}
            >
              Todos los temas
            </Chip>
            {material.analysis.topics.map((topic) => (
              <Chip key={topic.id} selected={config.topicIds.includes(topic.id)} onClick={() => toggleTopic(topic.id)}>
                {topic.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      {foreign && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-display text-lg font-semibold text-papa-900">Idioma de las preguntas</legend>
          <div className="flex flex-wrap gap-2">
            <Chip
              selected={config.language === "es"}
              onClick={() => setConfig((current) => ({ ...current, language: "es" }))}
            >
              Español
            </Chip>
            <Chip
              selected={config.language === "original"}
              onClick={() => setConfig((current) => ({ ...current, language: "original" }))}
            >
              Como el material ({LANGUAGE_NAMES[materialLanguage.slice(0, 2)] ?? materialLanguage})
            </Chip>
          </div>
        </fieldset>
      )}

      {remaining === 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-papa-100/80 px-4 py-3 text-sm text-papa-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Puede que no salgan todas las preguntas que pides. Prueba otro nivel, otros temas o reinicia el historial.
        </p>
      )}

      <button
        type="submit"
        disabled={creating}
        className="inline-flex items-center justify-center gap-2 self-stretch rounded-full bg-papa-500 px-8 py-3.5 font-display text-lg font-semibold text-white shadow-lg shadow-papa-500/30 transition hover:-translate-y-0.5 hover:bg-papa-600 disabled:translate-y-0 disabled:bg-papa-300 sm:self-start"
      >
        {creating ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Play className="size-5" aria-hidden />}
        ¡Crear mi quiz!
      </button>
    </form>
  );
}
