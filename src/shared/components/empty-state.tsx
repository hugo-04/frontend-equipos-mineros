import * as React from "react";

export function EmptyState({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono?: React.ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center"
    >
      {icono && <div className="text-muted-foreground">{icono}</div>}
      <p className="text-base font-semibold">{titulo}</p>
      {descripcion && <p className="text-muted-foreground max-w-sm text-sm">{descripcion}</p>}
      {accion}
    </div>
  );
}
