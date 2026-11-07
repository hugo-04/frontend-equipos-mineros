import { z, type ZodType } from "zod";
import type { Pagina } from "@/shared/types";

/** Esquema de la respuesta paginada del backend: `{page,size,totalElements,totalPages,first,last,content}` */
export function paginaSchema<T>(item: ZodType<T>): ZodType<Pagina<T>> {
  return z.object({
    page: z.number().int(),
    size: z.number().int(),
    totalElements: z.number().int(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
    content: z.array(item),
  }) as unknown as ZodType<Pagina<T>>;
}

export const idSchema = z
  .number()
  .int("El id debe ser un entero")
  .positive("El id debe ser mayor que 0");
