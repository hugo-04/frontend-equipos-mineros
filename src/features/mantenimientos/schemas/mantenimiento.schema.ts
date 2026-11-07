import { z } from "zod";
import { paginaSchema } from "@/shared/schemas/pagina";

export const mantenimientoSchema = z.object({
  id: z.number().int().positive(),
  equipoId: z.number().int().positive(),
  fecha: z.string(),
  horometroAlRegistrar: z.number(),
  // El backend omite `notas` cuando no hay; null se tolera y se normaliza a undefined
  notas: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
});

export const paginaMantenimientosSchema = paginaSchema(mantenimientoSchema);

export const NOTAS_MAXIMO = 500;

export const mantenimientoFormSchema = z.object({
  notas: z.string().trim().max(NOTAS_MAXIMO, `Las notas no pueden superar los ${NOTAS_MAXIMO} caracteres`).optional(),
});

export type MantenimientoFormValues = z.infer<typeof mantenimientoFormSchema>;
