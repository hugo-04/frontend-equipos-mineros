import * as React from "react";
import { Label } from "@/shared/components/ui/label";

/**
 * Etiqueta, control y mensaje de error accesible. El control tiene que recibir el id, el aria-invalid y el
 * aria-describedby que devuelve propsAccesibles, para que el lector de pantalla lea el error junto al campo.
 */
export function propsAccesibles(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

export function CampoFormulario({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && <p className="text-muted-foreground text-xs">{ayuda}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
