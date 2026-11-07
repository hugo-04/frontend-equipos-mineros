"use client";

import { AlertTriangle } from "lucide-react";
import { ApiError, classifyError } from "@/shared/api/api-error";
import { MENSAJE_SISTEMA } from "@/shared/api/error-handler";
import { Button } from "@/shared/components/ui/button";

/** Error de una consulta: mensaje amable, código de rastreo si el backend lo envió y botón para reintentar */
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
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 px-6 py-12 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      <p className="font-semibold">{mensaje}</p>
      {traceId && <p className="text-xs text-muted-foreground">Código de error: {traceId}</p>}
      {alReintentar && (
        <Button variant="outline" onClick={alReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
