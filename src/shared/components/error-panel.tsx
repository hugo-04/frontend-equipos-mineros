"use client";

import { AlertTriangle } from "lucide-react";
import { ApiError, classifyError } from "@/shared/api/api-error";
import { MENSAJE_SISTEMA } from "@/shared/api/error-handler";
import { Button } from "@/shared/components/ui/button";

/** Cuando falla una consulta: un mensaje amable, el código de rastreo si el backend lo mandó y un botón para reintentar. */
export function ErrorPanel({ error, alReintentar }: { error: unknown; alReintentar?: () => void }) {
  const categoria = classifyError(error);
  const traceId = error instanceof ApiError ? error.traceId : undefined;
  const mensaje =
    categoria === "forbidden"
      ? "No tienes permiso para ver esto."
      : categoria === "network"
        ? "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo."
        : MENSAJE_SISTEMA;
  return (
    <div
      role="alert"
      className="border-destructive/40 flex flex-col items-center gap-3 rounded-lg border px-6 py-12 text-center"
    >
      <AlertTriangle className="text-destructive size-8" aria-hidden="true" />
      <p className="font-semibold">{mensaje}</p>
      {traceId && <p className="text-muted-foreground text-xs">Código de error: {traceId}</p>}
      {alReintentar && (
        <Button variant="outline" onClick={alReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
