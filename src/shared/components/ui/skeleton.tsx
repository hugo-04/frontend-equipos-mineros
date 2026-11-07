import * as React from "react";
import { cn } from "@/shared/lib/utils";

/** Bloque de carga: el contenedor que lo usa debe tener la forma real del contenido para evitar saltos de layout */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
