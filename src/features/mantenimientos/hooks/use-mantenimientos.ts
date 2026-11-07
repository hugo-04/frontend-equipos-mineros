"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleMutationError } from "@/shared/api/error-handler";
import { equipoKeys } from "@/features/equipos";
import { listarMantenimientos, registrarMantenimiento } from "../api/mantenimientos.api";

export const TAMANO_HISTORIAL = 10;

export function useMantenimientos(equipoId: number, page: number) {
  return useQuery({
    queryKey: [...equipoKeys.mantenimientos(equipoId), page],
    queryFn: ({ signal }) => listarMantenimientos(equipoId, page, TAMANO_HISTORIAL, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useRegistrarMantenimiento(equipoId: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (notas?: string) => registrarMantenimiento(equipoId, notas),
    onSuccess: () => {
      // Cambia el estado del equipo: se invalidan detalle, historial y lista
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
