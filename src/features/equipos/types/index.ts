import type { z } from "zod";
import type { equipoSchema } from "../schemas/equipo.schema";

export type Equipo = z.infer<typeof equipoSchema>;

/** El cuerpo para crear un equipo (el EquipoRequest del contrato). */
export interface CrearEquipoRequest {
  codigo: string;
  tipoId: number;
  horometro: number;
}

/** El cuerpo para editarlo (el EquipoUpdateRequest): sin tipoId, porque el tipo no se puede cambiar. */
export interface EditarEquipoRequest {
  codigo: string;
  horometro: number;
}
