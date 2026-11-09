import { z } from "zod";
import { paginaSchema } from "@/shared/schemas/pagina";
import type {
  ApiMantenimiento,
  ApiMantenimientoRequest,
  Coinciden,
  Verificar,
} from "@/shared/types";

export const mantenimientoSchema = z.object({
  id: z.number().int().positive(),
  equipoId: z.number().int().positive(),
  fecha: z.string(),
  horometroAlRegistrar: z.number(),
  // El backend no manda "notas" cuando no hay; si llegara null también se acepta y se deja como undefined
  notas: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
});

export const paginaMantenimientosSchema = paginaSchema(mantenimientoSchema);

export const NOTAS_MAXIMO = 500;

/** Las notas son opcionales y pueden tener hasta 500 caracteres, igual que en el contrato. */
export const mantenimientoFormSchema = z.object({
  notas: z
    .string()
    .trim()
    .max(NOTAS_MAXIMO, `Las notas no pueden superar los ${NOTAS_MAXIMO} caracteres`)
    .optional(),
});

export type MantenimientoFormValues = z.infer<typeof mantenimientoFormSchema>;

// El contrato manda: si cambia un campo y estos esquemas no se ajustan, el typecheck falla en estas líneas.
export type MantenimientoCoincideConElContrato = Verificar<
  Coinciden<z.output<typeof mantenimientoSchema>, ApiMantenimiento>
>;
export type MantenimientoFormCoincideConElContrato = Verificar<
  Coinciden<MantenimientoFormValues, ApiMantenimientoRequest>
>;
