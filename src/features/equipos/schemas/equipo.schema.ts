import { z } from "zod";
import { paginaSchema } from "@/shared/schemas/pagina";
import { tipoEquipoSchema } from "@/features/tipos";
import type {
  ApiEquipo,
  ApiEquipoRequest,
  ApiEquipoUpdateRequest,
  Coinciden,
  Verificar,
} from "@/shared/types";

/** Cómo tiene que verse un equipo que llega del API. Si la respuesta no lo cumple, no se usa. */
export const equipoSchema = z.object({
  id: z.number().int().positive(),
  codigo: z.string(),
  tipo: tipoEquipoSchema,
  horometro: z.number(),
  horometroUltimoMant: z.number(),
  // Los calcula el backend en cada consulta; el frontend no los vuelve a calcular
  horasDesdeUltimoMant: z.number(),
  horasRestantes: z.number(),
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

const codigoEquipo = z
  .string({ error: "El código es obligatorio" })
  .trim()
  .min(3, "El código debe tener al menos 3 caracteres")
  .max(30, "El código no puede superar los 30 caracteres")
  .regex(/^[A-Za-z0-9-]+$/, "Solo letras, números y guiones");

/** De 0 a 999999.9 con un decimal como máximo, que es lo que acepta el contrato. */
const horometroEquipo = textoHorometro
  .pipe(z.string().regex(/^\d+(\.\d)?$/, "Máximo un decimal"))
  .transform(Number)
  .refine((n) => n >= 0, "El horómetro no puede ser negativo")
  .refine((n) => n <= HOROMETRO_MAXIMO, `El horómetro no puede superar ${HOROMETRO_MAXIMO}`);

/** Al crear se elige el tipo: es un entero mayor que 0 y después ya no se puede cambiar. */
export const crearEquipoSchema = z.object({
  codigo: codigoEquipo,
  tipoId: z
    .string({ error: "Selecciona un tipo" })
    .regex(/^[1-9]\d*$/, "Selecciona un tipo")
    .transform(Number),
  horometro: horometroEquipo,
});

/**
 * Al editar solo se cambian el código y el horómetro. El tipo no está en el esquema: es inmutable (el estado y
 * los mantenimientos se rigen por el intervalo de ese tipo), así que nunca viaja en una actualización. Zod
 * descarta los campos que no conoce, y por eso un `tipoId` suelto no llega al backend.
 *
 * `horometroActual` es el valor que ya tiene el equipo: el horómetro es un acumulado y no puede bajar.
 */
export function editarEquipoSchema(horometroActual?: number) {
  return z.object({
    codigo: codigoEquipo,
    horometro: horometroEquipo.refine(
      (n) => horometroActual === undefined || n >= horometroActual,
      `El horómetro no puede ser menor al actual (${horometroActual ?? 0})`,
    ),
  });
}

export type CrearEquipoInput = z.input<typeof crearEquipoSchema>;
export type CrearEquipoValues = z.output<typeof crearEquipoSchema>;
export type EditarEquipoInput = z.input<ReturnType<typeof editarEquipoSchema>>;
export type EditarEquipoValues = z.output<ReturnType<typeof editarEquipoSchema>>;

// El contrato manda: si cambia un campo y estos esquemas no se ajustan, el typecheck falla en estas líneas.
export type EquipoCoincideConElContrato = Verificar<
  Coinciden<z.output<typeof equipoSchema>, ApiEquipo>
>;
export type CrearEquipoCoincideConElContrato = Verificar<
  Coinciden<CrearEquipoValues, ApiEquipoRequest>
>;
export type EditarEquipoCoincideConElContrato = Verificar<
  Coinciden<EditarEquipoValues, ApiEquipoUpdateRequest>
>;
