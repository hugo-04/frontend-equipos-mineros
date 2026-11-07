import { z } from "zod";
import { paginaSchema } from "@/shared/schemas/pagina";
import { tipoEquipoSchema } from "@/features/tipos";

/** Respuesta del API: se valida antes de usarla (A08). */
export const equipoSchema = z.object({
  id: z.number().int().positive(),
  codigo: z.string(),
  tipo: tipoEquipoSchema,
  horometro: z.number(),
  horometroUltimoMant: z.number(),
  requiereMantenimiento: z.boolean(),
  estado: z.string(),
  creadoEn: z.string(),
});

export const paginaEquiposSchema = paginaSchema(equipoSchema);

export const HOROMETRO_MAXIMO = 999999.9;

const textoHorometro = z
  .string({ error: "El horómetro es obligatorio" })
  .trim()
  .min(1, "El horómetro es obligatorio")
  .transform((v) => v.replace(",", "."))
  .pipe(
    z
      .string()
      .refine((v) => !v.startsWith("-"), "El horómetro no puede ser negativo")
      .regex(/^\d+(\.\d+)?$/, "Ingresa un número válido (sin signo ni letras)"),
  );

/**
 * Esquema del formulario de equipo, alineado con el contrato:
 * codigo 3–30 [A-Za-z0-9-]; tipoId entero > 0; horometro 0–999999.9 con un decimal como máximo.
 * `horometroMinimo`: al editar, el horómetro no puede bajar del valor actual.
 */
export function crearEquipoFormSchema(opciones: { horometroMinimo?: number } = {}) {
  return z.object({
    codigo: z
      .string({ error: "El código es obligatorio" })
      .trim()
      .min(3, "El código debe tener al menos 3 caracteres")
      .max(30, "El código no puede superar los 30 caracteres")
      .regex(/^[A-Za-z0-9-]+$/, "Solo letras, números y guiones"),
    tipoId: z
      .string({ error: "Selecciona un tipo" })
      .regex(/^[1-9]\d*$/, "Selecciona un tipo")
      .transform(Number),
    horometro: textoHorometro
      .pipe(z.string().regex(/^\d+(\.\d)?$/, "Máximo un decimal"))
      .transform(Number)
      .refine((n) => n >= 0, "El horómetro no puede ser negativo")
      .refine((n) => n <= HOROMETRO_MAXIMO, `El horómetro no puede superar ${HOROMETRO_MAXIMO}`)
      .refine(
        (n) => opciones.horometroMinimo === undefined || n >= opciones.horometroMinimo,
        `El horómetro no puede ser menor al actual (${opciones.horometroMinimo ?? 0})`,
      ),
  });
}

export const equipoFormSchema = crearEquipoFormSchema();

export type EquipoFormInput = z.input<typeof equipoFormSchema>;
export type EquipoFormValues = z.output<typeof equipoFormSchema>;
