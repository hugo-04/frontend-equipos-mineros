import { peticion } from "@/shared/api/http";
import {
  loginSchema,
  sesionRespuestaSchema,
  type LoginValues,
  type SesionRespuesta,
} from "../schemas/login.schema";

/** Llama a la ruta propia /api/auth/login; el token queda en una cookie httpOnly y nunca llega al JavaScript. */
export function iniciarSesion(credenciales: LoginValues): Promise<SesionRespuesta> {
  return peticion("/api/auth/login", {
    metodo: "POST",
    cuerpo: loginSchema.parse(credenciales),
    esquema: sesionRespuestaSchema,
    rutaPropia: true,
  });
}

export function cerrarSesion(): Promise<void> {
  return peticion("/api/auth/logout", { metodo: "POST", rutaPropia: true });
}
