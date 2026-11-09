import { z } from "zod";
import { paginaSchema } from "@/shared/schemas/pagina";
import type { ApiTipoEquipo, Coinciden, Verificar } from "@/shared/types";

export const tipoEquipoSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string(),
  intervaloHoras: z.number(),
});

export const paginaTiposSchema = paginaSchema(tipoEquipoSchema);

// El contrato manda: si cambia un campo y este esquema no se ajusta, el typecheck falla en esta línea.
export type TipoEquipoCoincideConElContrato = Verificar<
  Coinciden<z.output<typeof tipoEquipoSchema>, ApiTipoEquipo>
>;
