import { z } from "zod";
import { paginaSchema } from "@/shared/schemas/pagina";

export const tipoEquipoSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string(),
  intervaloHoras: z.number(),
});

export const paginaTiposSchema = paginaSchema(tipoEquipoSchema);
