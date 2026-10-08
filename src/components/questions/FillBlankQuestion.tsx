"use client";

import { Fragment } from "react";
import { Markdown } from "@/components/Markdown";
import type { QuestionInputProps } from "./types";

export function FillBlankQuestion({
  question,
  response,
  onChange,
  review,
  disabled,
  blankResults,
  onSubmit,
}: QuestionInputProps<"fill_blank">) {
  const segments = question.prompt.split("____");
  const blanks = question.blanks ?? [];

  function update(index: number, value: string) {
    const values = [...response.values];
    values[index] = value;
    onChange({ type: "fill_blank", values });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="font-display text-xl leading-[2.6rem] text-papa-900 sm:text-2xl sm:leading-[3rem]">
        {segments.map((segment, index) => {
          const blank = blanks[index];
          const result = blankResults?.[index];
          const expectedLength = Math.max(6, Math.min(24, (blank?.accepted[0]?.length ?? 6) + 2));
          let border = "border-papa-300 focus:border-papa-500";
          if (result === true) border = "border-brote-500 bg-brote-50";
          if (result === false) border = "border-tomate-500 bg-tomate-50";
          return (
            <Fragment key={index}>
              {segment && <Markdown inline>{segment}</Markdown>}
              {index < segments.length - 1 && (
                <input
                  type="text"
                  value={response.values[index] ?? ""}
                  onChange={(event) => update(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSubmit?.();
                  }}
                  disabled={disabled || review}
                  aria-label={`Espacio ${index + 1}`}
                  autoComplete="off"
                  spellCheck={false}
                  style={{ width: `${expectedLength}ch` }}
                  className={`mx-1 inline-block rounded-xl border-2 bg-white px-2 py-0.5 text-center font-sans text-lg font-bold text-papa-900 outline-none transition disabled:opacity-100 ${border}`}
                />
              )}
            </Fragment>
          );
        })}
      </div>
      {review && (
        <ul className="flex flex-col gap-1 text-sm">
          {blanks.map((blank, index) => (
            <li key={index} className={blankResults?.[index] ? "text-brote-700" : "text-tomate-700"}>
              Espacio {index + 1}: <strong>{blank.accepted[0]}</strong>
              {blank.accepted.length > 1 && (
                <span className="text-papa-800/70"> (también vale: {blank.accepted.slice(1).join(", ")})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
