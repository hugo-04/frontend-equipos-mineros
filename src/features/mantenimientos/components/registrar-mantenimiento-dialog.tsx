"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Wrench } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { CampoFormulario, propsAccesibles } from "@/shared/components/campo-formulario";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/input";
import { useRegistrarMantenimiento } from "../hooks/use-mantenimientos";
import {
  mantenimientoFormSchema,
  NOTAS_MAXIMO,
  type MantenimientoFormValues,
} from "../schemas/mantenimiento.schema";

/**
 * Botón y diálogo para registrar un mantenimiento, con notas opcionales. Al registrarlo, el ciclo del equipo vuelve a empezar.
 * `destacado` lo pinta como acción principal (cuando el equipo ya requiere mantenimiento) y `compacto` lo achica para usarlo en una fila de la lista.
 */
export function RegistrarMantenimientoDialog({
  equipoId,
  codigo,
  destacado = true,
  compacto = false,
}: {
  equipoId: number;
  codigo: string;
  destacado?: boolean;
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const registrar = useRegistrarMantenimiento(equipoId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MantenimientoFormValues>({
    resolver: zodResolver(mantenimientoFormSchema),
    defaultValues: { notas: "" },
  });

  const cambiar = (valor: boolean) => {
    if (registrar.isPending) return;
    setAbierto(valor);
    if (!valor) reset();
  };

  const enviar = handleSubmit((valores) => {
    registrar.mutate(valores.notas || undefined, {
      onSuccess: () => {
        setAbierto(false);
        reset();
      },
    });
  });

  return (
    <>
      <Button
        variant={destacado ? "default" : "outline"}
        size={compacto ? "sm" : "default"}
        aria-label={`Registrar mantenimiento de ${codigo}`}
        title={`Registrar un mantenimiento que ya se hizo en ${codigo}`}
        onClick={() => setAbierto(true)}
      >
        <Wrench aria-hidden="true" />
        {compacto ? "Registrar" : "Registrar mantenimiento"}
      </Button>
      <Dialog open={abierto} onOpenChange={cambiar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar mantenimiento de {codigo}</DialogTitle>
            <DialogDescription>
              Úsalo cuando ya se hizo el mantenimiento de este equipo. Queda guardado en su
              historial con la fecha y el horómetro de ahora, y el conteo de horas hasta el próximo
              mantenimiento vuelve a empezar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={enviar} noValidate className="space-y-4">
            <CampoFormulario
              id="notas"
              etiqueta="Notas (opcional)"
              error={errors.notas?.message}
              ayuda={`Máximo ${NOTAS_MAXIMO} caracteres`}
            >
              <Textarea
                {...propsAccesibles("notas", errors.notas?.message)}
                disabled={registrar.isPending}
                {...register("notas")}
              />
            </CampoFormulario>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={registrar.isPending}
                onClick={() => cambiar(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" cargando={registrar.isPending}>
                {registrar.isPending ? "Registrando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
