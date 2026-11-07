import { peticion } from "@/shared/api/http";
import { obtenerTodasLasPaginas } from "@/shared/api/paginacion";
import { paginaTiposSchema } from "../schemas/tipo.schema";
import type { TipoEquipo } from "../types";

/** Trae todo el catálogo de tipos de equipo. */
export function listarTipos(signal?: AbortSignal): Promise<TipoEquipo[]> {
  return obtenerTodasLasPaginas((page, size) =>
    peticion(`/tipos?page=${page}&size=${size}`, { esquema: paginaTiposSchema, signal }),
  );
}
