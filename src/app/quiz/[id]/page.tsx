import { Suspense } from "react";
import { PageLoading } from "@/components/PageMessage";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";

export default function QuizPage({ params }: PageProps<"/quiz/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Abriendo tu quiz…" />}>
      {params.then(({ id }) => (
        <QuizPlayer key={id} id={id} />
      ))}
    </Suspense>
  );
}
