import type { z } from "zod";
import type { equipoSchema } from "../schemas/equipo.schema";

export type Equipo = z.infer<typeof equipoSchema>;

/** El cuerpo que recibe el backend para crear o editar un equipo (el EquipoRequest del contrato). */
export interface EquipoRequest {
  codigo: string;
  tipoId: number;
  horometro: number;
}
