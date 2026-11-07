import "server-only";
import { redirect } from "next/navigation";
import { tokenVigente } from "@/shared/lib/jwt-claims";
import { llamarBackend } from "./backend";
import { leerToken } from "./session";

/**
 * Segunda defensa de las rutas protegidas (la primera es proxy.ts): comprueba la sesión contra el backend en cada
 * render. Falla cerrado: si no hay cookie vigente, si el backend rechaza el token o si no responde, se trata como
 * no autenticado y se manda al login.
 */
export async function exigirSesion(rutaActual: string): Promise<void> {
  const token = await leerToken();
  const irAlLogin = () =>
    redirect(`/api/auth/sesion-invalida?from=${encodeURIComponent(rutaActual)}`);
  if (!tokenVigente(token)) return irAlLogin();
  try {
    const respuesta = await llamarBackend("tipos?page=0&size=1", { metodo: "GET", token });
    if (respuesta.status !== 200) return irAlLogin();
  } catch {
    return irAlLogin();
  }
}
