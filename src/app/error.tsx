"use client";

import { MENSAJE_SISTEMA } from "@/shared/api/error-handler";
import { Button } from "@/shared/components/ui/button";

/** Falla inesperada de una ruta. Nunca se muestra el error crudo ni la traza. */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{MENSAJE_SISTEMA}</h1>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
