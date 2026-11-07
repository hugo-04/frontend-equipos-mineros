"use client";

import { useQuery } from "@tanstack/react-query";
import { listarTipos } from "../api/tipos.api";

export const tipoKeys = {
  all: ["tipos"] as const,
  list: () => [...tipoKeys.all, "list"] as const,
};

export function useTipos() {
  return useQuery({
    queryKey: tipoKeys.list(),
    queryFn: ({ signal }) => listarTipos(signal),
    staleTime: 5 * 60_000, // el catálogo casi no cambia
  });
}
