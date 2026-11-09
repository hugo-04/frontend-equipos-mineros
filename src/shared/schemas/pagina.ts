import { z, type ZodType } from "zod";
import type { Coinciden, Pagina, PaginaBase, Verificar } from "@/shared/types";

/** Los datos de paginación que trae todo listado del backend (el PaginaBase del contrato). */
const paginaBaseSchema = z.object({
  page: z.number().int(),
  size: z.number().int(),
  totalElements: z.number().int(),
  totalPages: z.number().int(),
  first: z.boolean(),
  last: z.boolean(),
});

// El contrato manda: si el PaginaBase cambia y este esquema no se ajusta, el typecheck falla en esta línea.
export type PaginaBaseCoincideConElContrato = Verificar<
  Coinciden<z.output<typeof paginaBaseSchema>, PaginaBase>
>;

/** Esquema de la página que devuelve el backend: los datos de paginación más el contenido. */
export function paginaSchema<T>(item: ZodType<T>): ZodType<Pagina<T>> {
  return paginaBaseSchema.extend({ content: z.array(item) }) as unknown as ZodType<Pagina<T>>;
}

export const idSchema = z
  .number()
  .int("El id debe ser un entero")
  .positive("El id debe ser mayor que 0");
