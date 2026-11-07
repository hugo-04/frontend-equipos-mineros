import "server-only";
import { redirect } from "next/navigation";
import { tokenVigente } from "@/shared/lib/jwt-claims";
import { llamarBackend } from "./backend";
import { leerToken } from "./session";

/**
 * Segunda defensa (la primera es proxy.ts): valida la sesión CONTRA EL BACKEND en cada render protegido.
 * Falla cerrado: si no hay cookie vigente, el backend rechaza el token o no responde, se trata como no autenticado.
 */
export async function exigirSesion(rutaActual: string): Promise<void> {
  const token = await leerToken();
  const irAlLogin = () =>
    redirect(`/api/auth/sesion-invalida?from=${encodeURIComponent(rutaActual)}`);
  if (!tokenVigente(token)) return irAlLogin();
  try {
    const respuesta = await llamarBackend("tipos?page=1&size=1", { metodo: "GET", token });
    if (respuesta.status !== 200) return irAlLogin();
  } catch {
    return irAlLogin();
  }
}
