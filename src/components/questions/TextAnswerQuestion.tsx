"use client";

import { Markdown } from "@/components/Markdown";
import type { QuestionInputProps } from "./types";

type TextProps = QuestionInputProps<"short_answer"> | QuestionInputProps<"open_ended">;

export function TextAnswerQuestion(props: TextProps) {
  const { question, response, review, disabled, onSubmit } = props;
  const open = response.type === "open_ended";

  function update(text: string) {
    if (response.type === "open_ended") {
      (props as QuestionInputProps<"open_ended">).onChange({ type: "open_ended", text });
    } else {
      (props as QuestionInputProps<"short_answer">).onChange({ type: "short_answer", text });
    }
  }

  const className =
    "w-full rounded-2xl border-2 border-papa-200 bg-white px-4 py-3 text-lg text-papa-900 outline-none transition placeholder:text-papa-800/40 focus:border-papa-500 disabled:bg-papa-50";

  return (
    <div className="flex flex-col gap-3">
      {open ? (
        <>
          <textarea
            value={response.text}
            onChange={(event) => update(event.target.value)}
            disabled={disabled || review}
            rows={6}
            maxLength={3000}
            placeholder="Escribe tu respuesta con tus propias palabras…"
            aria-label="Tu respuesta"
            className={className}
          />
          {!review && <p className="self-end text-xs text-papa-800/60">{response.text.length}/3000</p>}
        </>
      ) : (
        <input
          type="text"
          value={response.text}
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit?.();
          }}
          disabled={disabled || review}
          maxLength={200}
          placeholder="Tu respuesta"
          aria-label="Tu respuesta"
          autoComplete="off"
          className={className}
        />
      )}
      {review && (
        <div className="rounded-2xl bg-brote-50 px-4 py-3 text-sm text-brote-700 ring-1 ring-brote-100">
          <p className="font-extrabold">{open ? "Una respuesta completa sería:" : "Respuesta esperada:"}</p>
          <Markdown className="mt-1 text-papa-900">{question.modelAnswer}</Markdown>
          {!open && (question.acceptedAnswers?.length ?? 0) > 1 && (
            <p className="mt-1 text-papa-800/80">También vale: {question.acceptedAnswers?.slice(1).join(", ")}</p>
          )}
          {open && question.rubric && (
            <>
              <p className="mt-2 font-extrabold">Puntos clave:</p>
              <ul className="mt-1 list-disc pl-5 text-papa-900">
                {question.rubric.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
