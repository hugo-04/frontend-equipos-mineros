import { peticion } from "@/shared/api/http";
import { idSchema } from "@/shared/schemas/pagina";
import type { Pagina } from "@/shared/types";
import {
  mantenimientoFormSchema,
  mantenimientoSchema,
  paginaMantenimientosSchema,
} from "../schemas/mantenimiento.schema";
import type { Mantenimiento } from "../types";

/** Una página del historial de un equipo (la pagina el backend). */
export function listarMantenimientos(
  equipoId: number,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<Pagina<Mantenimiento>> {
  const id = idSchema.parse(equipoId);
  return peticion(`/equipos/${encodeURIComponent(id)}/mantenimientos?page=${page}&size=${size}`, {
    esquema: paginaMantenimientosSchema,
    signal,
  });
}

/** Registra un mantenimiento. Las notas son opcionales y se validan (máximo 500) antes de enviar. */
export function registrarMantenimiento(equipoId: number, notas?: string): Promise<Mantenimiento> {
  const id = idSchema.parse(equipoId);
  const cuerpo = mantenimientoFormSchema.parse({ notas });
  return peticion(`/equipos/${encodeURIComponent(id)}/mantenimientos`, {
    metodo: "POST",
    cuerpo: cuerpo.notas ? { notas: cuerpo.notas } : {},
    esquema: mantenimientoSchema,
  });
}
