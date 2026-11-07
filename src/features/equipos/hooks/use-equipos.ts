"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleMutationError, type OpcionesManejo } from "@/shared/api/error-handler";
import {
  actualizarEquipo,
  crearEquipo,
  eliminarEquipo,
  listarEquipos,
  obtenerEquipo,
} from "../api/equipos.api";
import type { EquipoRequest } from "../types";

/** Todas las claves de consulta salen de acá; ningún componente arma una a mano. Así invalidar es siempre consistente. */
export const equipoKeys = {
  all: ["equipos"] as const,
  list: () => [...equipoKeys.all, "list"] as const,
  detail: (id: number) => [...equipoKeys.all, "detail", id] as const,
  mantenimientos: (id: number) => [...equipoKeys.all, "mantenimientos", id] as const,
};

/** Trae la lista de equipos. Al crear, editar o eliminar se invalida esta consulta y la tabla se refresca sola. */
export function useEquipos() {
  return useQuery({
    queryKey: equipoKeys.list(),
    queryFn: ({ signal }) => listarEquipos(signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/** Trae un equipo por id. */
export function useEquipo(id: number) {
  return useQuery({
    queryKey: equipoKeys.detail(id),
    queryFn: ({ signal }) => obtenerEquipo(id, signal),
    staleTime: 30_000,
  });
}

/** Crea un equipo, refresca la lista y avisa con un toast. Un código repetido (409) se marca en el campo código. */
export function useCrearEquipo(opciones: () => OpcionesManejo = () => ({})) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: EquipoRequest) => crearEquipo(cuerpo),
    onSuccess: (equipo) => {
      void cliente.invalidateQueries({ queryKey: equipoKeys.list() });
      toast.success(`Equipo ${equipo.codigo} creado`);
    },
    onError: (error) => handleMutationError(error, { campoConflicto: "codigo", ...opciones() }),
  });
}

/** Edita un equipo y refresca la lista y el detalle. */
export function useActualizarEquipo(id: number, opciones: () => OpcionesManejo = () => ({})) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: EquipoRequest) => actualizarEquipo(id, cuerpo),
    onSuccess: (equipo) => {
      void cliente.invalidateQueries({ queryKey: equipoKeys.list() });
      void cliente.invalidateQueries({ queryKey: equipoKeys.detail(id) });
      toast.success(`Equipo ${equipo.codigo} actualizado`);
    },
    onError: (error) =>
      handleMutationError(error, {
        campoConflicto: "codigo",
        alNoEncontrado: () => void cliente.invalidateQueries({ queryKey: equipoKeys.list() }),
        ...opciones(),
      }),
  });
}

/** Elimina un equipo y descarta lo que tenía en caché (detalle e historial) antes de refrescar la lista. */
export function useEliminarEquipo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; codigo: string }) => eliminarEquipo(id),
    onSuccess: (_, { id, codigo }) => {
      cliente.removeQueries({ queryKey: equipoKeys.detail(id) });
      cliente.removeQueries({ queryKey: equipoKeys.mantenimientos(id) });
      void cliente.invalidateQueries({ queryKey: equipoKeys.list() });
      toast.success(`Equipo ${codigo} eliminado`);
    },
    onError: (error) =>
      handleMutationError(error, {
        alNoEncontrado: () => void cliente.invalidateQueries({ queryKey: equipoKeys.list() }),
      }),
  });
}
