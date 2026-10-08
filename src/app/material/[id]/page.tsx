import { Suspense } from "react";
import { MaterialView } from "@/components/material/MaterialView";
import { PageLoading } from "@/components/PageMessage";

export default function MaterialPage({ params }: PageProps<"/material/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Abriendo tu material…" />}>
      {params.then(({ id }) => (
        <MaterialView key={id} id={id} />
      ))}
    </Suspense>
  );
}
