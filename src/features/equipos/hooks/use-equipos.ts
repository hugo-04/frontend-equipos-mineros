"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleMutationError, type OpcionesManejo } from "@/shared/api/error-handler";
import { actualizarEquipo, crearEquipo, eliminarEquipo, listarEquipos, obtenerEquipo } from "../api/equipos.api";
import type { EquipoRequest } from "../types";

/** Claves de consulta centralizadas: nadie fuera de este archivo arma una clave a mano */
export const equipoKeys = {
  all: ["equipos"] as const,
  list: () => [...equipoKeys.all, "list"] as const,
  detail: (id: number) => [...equipoKeys.all, "detail", id] as const,
  mantenimientos: (id: number) => [...equipoKeys.all, "mantenimientos", id] as const,
};

export function useEquipos() {
  return useQuery({
    queryKey: equipoKeys.list(),
    queryFn: ({ signal }) => listarEquipos(signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useEquipo(id: number) {
  return useQuery({
    queryKey: equipoKeys.detail(id),
    queryFn: ({ signal }) => obtenerEquipo(id, signal),
    staleTime: 30_000,
  });
}

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
