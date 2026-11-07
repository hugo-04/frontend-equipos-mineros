"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleMutationError } from "@/shared/api/error-handler";
import { equipoKeys } from "@/features/equipos";
import { listarMantenimientos, registrarMantenimiento } from "../api/mantenimientos.api";

/** Cuántos registros del historial se piden por página. */
export const TAMANO_HISTORIAL = 10;

/** Una página del historial. Mientras llega la siguiente se sigue mostrando la anterior. */
export function useMantenimientos(equipoId: number, page: number) {
  return useQuery({
    queryKey: [...equipoKeys.mantenimientos(equipoId), page],
    queryFn: ({ signal }) => listarMantenimientos(equipoId, page, TAMANO_HISTORIAL, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Registra un mantenimiento y refresca lo que cambia con él. */
export function useRegistrarMantenimiento(equipoId: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (notas?: string) => registrarMantenimiento(equipoId, notas),
    onSuccess: () => {
      // Al registrar un mantenimiento cambia el estado del equipo, así que se refrescan el detalle, el historial y la lista
      void cliente.invalidateQueries({ queryKey: equipoKeys.detail(equipoId) });
      void cliente.invalidateQueries({ queryKey: equipoKeys.mantenimientos(equipoId) });
      void cliente.invalidateQueries({ queryKey: equipoKeys.list() });
      toast.success("Mantenimiento registrado");
    },
    onError: (error) =>
      handleMutationError(error, {
        campos: ["notas"],
        alNoEncontrado: () => void cliente.invalidateQueries({ queryKey: equipoKeys.list() }),
      }),
  });
}
