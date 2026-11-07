import { peticion } from "@/shared/api/http";
import {
  loginSchema,
  sesionRespuestaSchema,
  type LoginValues,
  type SesionRespuesta,
} from "../schemas/login.schema";

/** Inicia sesión por la ruta propia /api/auth/login. El token queda en una cookie httpOnly y el JavaScript nunca lo ve. */
export function iniciarSesion(credenciales: LoginValues): Promise<SesionRespuesta> {
  return peticion("/api/auth/login", {
    metodo: "POST",
    cuerpo: loginSchema.parse(credenciales),
    esquema: sesionRespuestaSchema,
    rutaPropia: true,
  });
}

/** Cierra la sesión: el servidor borra la cookie. */
export function cerrarSesion(): Promise<void> {
  return peticion("/api/auth/logout", { metodo: "POST", rutaPropia: true });
}
