import { z } from "zod";

/** Mismos límites que el contrato del backend (LoginRequest). */
export const loginSchema = z.object({
  username: z
    .string({ error: "El usuario es obligatorio" })
    .trim()
    .min(1, "El usuario es obligatorio")
    .max(100, "El usuario no puede superar los 100 caracteres"),
  password: z
    .string({ error: "La contraseña es obligatoria" })
    .min(1, "La contraseña es obligatoria")
    .max(200, "La contraseña no puede superar los 200 caracteres"),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** Lo que el servidor de Next devuelve al navegador: nunca el token. */
export const sesionRespuestaSchema = z.object({
  ok: z.literal(true),
  usuario: z.object({ username: z.string(), rol: z.string().optional() }),
});

export type SesionRespuesta = z.infer<typeof sesionRespuestaSchema>;
