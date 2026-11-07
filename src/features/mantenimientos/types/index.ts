import type { z } from "zod";
import type { mantenimientoSchema } from "../schemas/mantenimiento.schema";

export type Mantenimiento = z.infer<typeof mantenimientoSchema>;
