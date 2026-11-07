import type { z } from "zod";
import type { tipoEquipoSchema } from "../schemas/tipo.schema";

export type TipoEquipo = z.infer<typeof tipoEquipoSchema>;
