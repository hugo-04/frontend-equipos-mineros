"use client";

import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

export interface ConfirmDialogProps {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  titulo: string;
  /** Tiene que decir qué se va a afectar (por ejemplo, el código del equipo). */
  descripcion: React.ReactNode;
  textoConfirmar?: string;
  cargando?: boolean;
  alConfirmar: () => void;
}

/** Confirmación para acciones que no se pueden deshacer. No se deja cerrar mientras la operación sigue en curso. */
export function ConfirmDialog({
  abierto,
  alCambiar,
  titulo,
  descripcion,
  textoConfirmar = "Eliminar",
  cargando = false,
  alConfirmar,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={abierto} onOpenChange={(valor) => !cargando && alCambiar(valor)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={cargando}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          {/* Es un Button normal y no el Action de Radix, porque ese cierra el diálogo antes de que termine la mutación */}
          <Button variant="destructive" cargando={cargando} onClick={alConfirmar}>
            {cargando ? "Eliminando…" : textoConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
