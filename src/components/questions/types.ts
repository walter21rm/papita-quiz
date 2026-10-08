import type { Question, UserResponse } from "@/lib/types";

export type ResponseOf<T extends UserResponse["type"]> = Extract<UserResponse, { type: T }>;

export interface QuestionInputProps<T extends UserResponse["type"]> {
  question: Question;
  response: ResponseOf<T>;
  onChange: (response: ResponseOf<T>) => void;
  /** Shows the correct answer next to the student's one. */
  review: boolean;
  disabled: boolean;
  blankResults?: boolean[];
  onSubmit?: () => void;
}
