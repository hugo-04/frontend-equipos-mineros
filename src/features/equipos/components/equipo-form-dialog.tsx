"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTipos } from "@/features/tipos";
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
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useActualizarEquipo, useCrearEquipo } from "../hooks/use-equipos";
import {
  crearEquipoFormSchema,
  type EquipoFormInput,
  type EquipoFormValues,
} from "../schemas/equipo.schema";
import type { Equipo } from "../types";

const CAMPOS = ["codigo", "tipoId", "horometro"] as const;

interface Props {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  /** Con un equipo, el formulario lo edita; sin él, crea uno nuevo. */
  equipo?: Equipo | null;
}

/** Diálogo para crear o editar un equipo. Valida con Zod antes de enviar y pone los errores del backend junto a cada campo. */
export function EquipoFormDialog({ abierto, alCambiar, equipo }: Props) {
  const editando = Boolean(equipo);
  const esquema = useMemo(
    () => crearEquipoFormSchema({ horometroMinimo: equipo?.horometro }),
    [equipo?.horometro],
  );
  const tipos = useTipos();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EquipoFormInput, unknown, EquipoFormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { codigo: "", tipoId: "", horometro: "" },
  });

  // Al abrir se cargan los datos del equipo, o se vacía el formulario si es uno nuevo
  useEffect(() => {
    if (!abierto) return;
    reset(
      equipo
        ? {
            codigo: equipo.codigo,
            tipoId: String(equipo.tipo.id),
            horometro: String(equipo.horometro),
          }
        : { codigo: "", tipoId: "", horometro: "" },
    );
  }, [abierto, equipo, reset]);

  const opciones = () => ({
    campos: CAMPOS,
    ponerErrorEnCampo: (campo: string, mensaje: string) =>
      setError(campo as (typeof CAMPOS)[number], { message: mensaje }),
  });
  const crear = useCrearEquipo(opciones);
  const actualizar = useActualizarEquipo(equipo?.id ?? 0, opciones);
  const mutacion = editando ? actualizar : crear;
  const enviando = mutacion.isPending;

  const guardar = handleSubmit((valores) => {
    mutacion.mutate(valores, { onSuccess: () => alCambiar(false) });
  });

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !enviando && alCambiar(valor)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? `Editar ${equipo?.codigo}` : "Nuevo equipo"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "El horómetro no puede bajar del valor actual."
              : "Registra un equipo con su horómetro actual."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} noValidate className="space-y-4">
          <CampoFormulario
            id="codigo"
            etiqueta="Código"
            error={errors.codigo?.message}
            ayuda="3 a 30 caracteres: letras, números y guiones"
          >
            <Input
              {...propsAccesibles("codigo", errors.codigo?.message)}
              disabled={enviando}
              autoComplete="off"
              {...register("codigo")}
            />
          </CampoFormulario>

          <CampoFormulario id="tipoId" etiqueta="Tipo de equipo" error={errors.tipoId?.message}>
            <Controller
              control={control}
              name="tipoId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={enviando || tipos.isPending}
                >
                  <SelectTrigger
                    {...propsAccesibles("tipoId", errors.tipoId?.message)}
                    onBlur={field.onBlur}
                  >
                    <SelectValue
                      placeholder={tipos.isPending ? "Cargando tipos…" : "Selecciona un tipo"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(tipos.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nombre} · cada {t.intervaloHoras} h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </CampoFormulario>

          <CampoFormulario
            id="horometro"
            etiqueta="Horómetro (horas)"
            error={errors.horometro?.message}
            ayuda="Entre 0 y 999999.9, con un decimal como máximo"
          >
            <Input
              {...propsAccesibles("horometro", errors.horometro?.message)}
              inputMode="decimal"
              disabled={enviando}
              autoComplete="off"
              {...register("horometro")}
            />
          </CampoFormulario>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={enviando}
              onClick={() => alCambiar(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" cargando={enviando}>
              {enviando ? "Guardando…" : editando ? "Guardar cambios" : "Crear equipo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
