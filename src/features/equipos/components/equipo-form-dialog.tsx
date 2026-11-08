"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { Controller, useForm, type UseFormRegisterReturn } from "react-hook-form";
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
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { formatearHorometro } from "@/shared/lib/formatters";
import { useActualizarEquipo, useCrearEquipo } from "../hooks/use-equipos";
import {
  crearEquipoSchema,
  editarEquipoSchema,
  type CrearEquipoInput,
  type CrearEquipoValues,
  type EditarEquipoInput,
  type EditarEquipoValues,
} from "../schemas/equipo.schema";
import type { Equipo } from "../types";

const CAMPOS_CREAR = ["codigo", "tipoId", "horometro"] as const;
const CAMPOS_EDITAR = ["codigo", "horometro"] as const;

interface Props {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  /** Con un equipo, el formulario lo edita; sin él, crea uno nuevo. */
  equipo?: Equipo | null;
}

/**
 * Diálogo para crear o editar un equipo. Son dos formularios con esquemas distintos: al crear se elige el tipo;
 * al editar el tipo se muestra de solo lectura y solo se mandan código y horómetro.
 */
export function EquipoFormDialog({ abierto, alCambiar, equipo }: Props) {
  return equipo ? (
    <EditarEquipoDialog abierto={abierto} alCambiar={alCambiar} equipo={equipo} />
  ) : (
    <CrearEquipoDialog abierto={abierto} alCambiar={alCambiar} />
  );
}

function CampoCodigo({
  registro,
  error,
  deshabilitado,
}: {
  registro: UseFormRegisterReturn;
  error?: string;
  deshabilitado: boolean;
}) {
  return (
    <CampoFormulario
      id="codigo"
      etiqueta="Código"
      error={error}
      ayuda="3 a 30 caracteres: letras, números y guiones"
    >
      <Input
        {...propsAccesibles("codigo", error)}
        disabled={deshabilitado}
        autoComplete="off"
        {...registro}
      />
    </CampoFormulario>
  );
}

function CampoHorometro({
  registro,
  error,
  deshabilitado,
  ayuda,
}: {
  registro: UseFormRegisterReturn;
  error?: string;
  deshabilitado: boolean;
  ayuda: string;
}) {
  return (
    <CampoFormulario id="horometro" etiqueta="Horómetro (horas)" error={error} ayuda={ayuda}>
      <Input
        {...propsAccesibles("horometro", error)}
        inputMode="decimal"
        disabled={deshabilitado}
        autoComplete="off"
        {...registro}
      />
    </CampoFormulario>
  );
}

function PieDelFormulario({
  enviando,
  textoEnviar,
  textoEnviando,
  alCancelar,
}: {
  enviando: boolean;
  textoEnviar: string;
  textoEnviando: string;
  alCancelar: () => void;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" disabled={enviando} onClick={alCancelar}>
        Cancelar
      </Button>
      <Button type="submit" cargando={enviando}>
        {enviando ? textoEnviando : textoEnviar}
      </Button>
    </DialogFooter>
  );
}

function CrearEquipoDialog({
  abierto,
  alCambiar,
}: {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
}) {
  const tipos = useTipos();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CrearEquipoInput, unknown, CrearEquipoValues>({
    resolver: zodResolver(crearEquipoSchema),
    defaultValues: { codigo: "", tipoId: "", horometro: "" },
  });

  // Cada vez que se abre, el formulario empieza vacío
  useEffect(() => {
    if (abierto) reset({ codigo: "", tipoId: "", horometro: "" });
  }, [abierto, reset]);

  const crear = useCrearEquipo(() => ({
    campos: CAMPOS_CREAR,
    ponerErrorEnCampo: (campo: string, mensaje: string) =>
      setError(campo as (typeof CAMPOS_CREAR)[number], { message: mensaje }),
  }));
  const enviando = crear.isPending;

  const guardar = handleSubmit((valores) => {
    crear.mutate(valores, { onSuccess: () => alCambiar(false) });
  });

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !enviando && alCambiar(valor)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo equipo</DialogTitle>
          <DialogDescription>
            Registra un equipo con su horómetro actual. El tipo no se podrá cambiar después.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} noValidate className="space-y-4">
          <CampoCodigo
            registro={register("codigo")}
            error={errors.codigo?.message}
            deshabilitado={enviando}
          />

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

          <CampoHorometro
            registro={register("horometro")}
            error={errors.horometro?.message}
            deshabilitado={enviando}
            ayuda="Entre 0 y 999999.9, con un decimal como máximo"
          />

          <PieDelFormulario
            enviando={enviando}
            textoEnviar="Crear equipo"
            textoEnviando="Guardando…"
            alCancelar={() => alCambiar(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarEquipoDialog({
  abierto,
  alCambiar,
  equipo,
}: {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  equipo: Equipo;
}) {
  // El horómetro no puede bajar del valor que tiene el equipo ahora
  const esquema = useMemo(() => editarEquipoSchema(equipo.horometro), [equipo.horometro]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EditarEquipoInput, unknown, EditarEquipoValues>({
    resolver: zodResolver(esquema),
    defaultValues: { codigo: equipo.codigo, horometro: String(equipo.horometro) },
  });

  // Al abrir se cargan los datos actuales del equipo
  useEffect(() => {
    if (abierto) reset({ codigo: equipo.codigo, horometro: String(equipo.horometro) });
  }, [abierto, equipo, reset]);

  const actualizar = useActualizarEquipo(equipo.id, () => ({
    campos: CAMPOS_EDITAR,
    ponerErrorEnCampo: (campo: string, mensaje: string) =>
      setError(campo as (typeof CAMPOS_EDITAR)[number], { message: mensaje }),
  }));
  const enviando = actualizar.isPending;

  // Solo viajan código y horómetro: el tipo no forma parte del formulario de edición
  const guardar = handleSubmit((valores) => {
    actualizar.mutate(valores, { onSuccess: () => alCambiar(false) });
  });

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !enviando && alCambiar(valor)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {equipo.codigo}</DialogTitle>
          <DialogDescription>
            Puedes cambiar el código y el horómetro. El horómetro no puede bajar del valor actual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} noValidate className="space-y-4">
          <CampoCodigo
            registro={register("codigo")}
            error={errors.codigo?.message}
            deshabilitado={enviando}
          />

          <div className="space-y-1.5">
            <Label id="tipo-etiqueta">Tipo de equipo</Label>
            <p
              aria-labelledby="tipo-etiqueta"
              aria-describedby="tipo-nota"
              className="border-input bg-muted text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm"
            >
              {equipo.tipo.nombre} · cada {equipo.tipo.intervaloHoras} h
            </p>
            <p id="tipo-nota" className="text-muted-foreground text-xs">
              El tipo no se puede cambiar. Si te equivocaste, elimina el equipo y créalo de nuevo.
            </p>
          </div>

          <CampoHorometro
            registro={register("horometro")}
            error={errors.horometro?.message}
            deshabilitado={enviando}
            ayuda={`Mínimo permitido: ${formatearHorometro(equipo.horometro)} (el valor actual). Máximo 999999.9, con un decimal`}
          />

          <PieDelFormulario
            enviando={enviando}
            textoEnviar="Guardar cambios"
            textoEnviando="Guardando…"
            alCancelar={() => alCambiar(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
