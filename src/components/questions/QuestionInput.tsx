"use client";

import type { Question, UserResponse } from "@/lib/types";
import { ChoiceQuestion } from "./ChoiceQuestion";
import { FillBlankQuestion } from "./FillBlankQuestion";
import { MatchingQuestion } from "./MatchingQuestion";
import { OrderingQuestion } from "./OrderingQuestion";
import { TextAnswerQuestion } from "./TextAnswerQuestion";
import { TrueFalseQuestion } from "./TrueFalseQuestion";

interface QuestionInputProps {
  question: Question;
  response: UserResponse;
  onChange: (response: UserResponse) => void;
  review: boolean;
  disabled: boolean;
  blankResults?: boolean[];
  onSubmit?: () => void;
}

export function QuestionInput({ response, ...rest }: QuestionInputProps) {
  switch (response.type) {
    case "single_choice":
    case "multiple_choice":
      return <ChoiceQuestion {...rest} response={response as never} onChange={rest.onChange} />;
    case "true_false":
      return <TrueFalseQuestion {...rest} response={response} onChange={rest.onChange} />;
    case "fill_blank":
      return <FillBlankQuestion {...rest} response={response} onChange={rest.onChange} />;
    case "short_answer":
    case "open_ended":
      return <TextAnswerQuestion {...rest} response={response as never} onChange={rest.onChange} />;
    case "matching":
      return <MatchingQuestion {...rest} response={response} onChange={rest.onChange} />;
    case "ordering":
      return <OrderingQuestion {...rest} response={response} onChange={rest.onChange} />;
  }
}
