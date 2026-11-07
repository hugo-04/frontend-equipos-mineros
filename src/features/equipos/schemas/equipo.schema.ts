import { z } from "zod";
import { paginaSchema } from "@/shared/schemas/pagina";
import { tipoEquipoSchema } from "@/features/tipos";

/** Cómo tiene que verse un equipo que llega del API. Si la respuesta no lo cumple, no se usa. */
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
 * Las reglas del formulario de equipo, que son las mismas del contrato: el código tiene de 3 a 30 letras, números
 * o guiones; el tipo es un entero mayor que 0; y el horómetro va de 0 a 999999.9 con un decimal como máximo.
 * Al editar se pasa `horometroMinimo` (el valor actual) porque el horómetro no puede bajar.
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
