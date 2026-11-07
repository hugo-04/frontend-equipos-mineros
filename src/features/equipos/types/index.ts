import type { z } from "zod";
import type { equipoSchema } from "../schemas/equipo.schema";

export type Equipo = z.infer<typeof equipoSchema>;

/** Cuerpo que acepta el backend para crear o editar (EquipoRequest del contrato) */
export interface EquipoRequest {
  codigo: string;
  tipoId: number;
  horometro: number;
}
