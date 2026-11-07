"use client";

import { useQuery } from "@tanstack/react-query";
import { listarTipos } from "../api/tipos.api";

/** Claves de consulta del catálogo de tipos. */
export const tipoKeys = {
  all: ["tipos"] as const,
  list: () => [...tipoKeys.all, "list"] as const,
};

/** Trae los tipos de equipo. Casi no cambian, por eso se guardan 5 minutos sin volver a pedirlos. */
export function useTipos() {
  return useQuery({
    queryKey: tipoKeys.list(),
    queryFn: ({ signal }) => listarTipos(signal),
    staleTime: 5 * 60_000, // el catálogo casi no cambia
  });
}
