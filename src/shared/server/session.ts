import "server-only";
import { cookies } from "next/headers";
import { COOKIE_SESION } from "@/shared/lib/sesion-cookie";
import { esProduccion } from "./config";

/** En producción el prefijo __Host- obliga a Secure, path=/ y sin Domain (la cookie queda atada al host). */
export { COOKIE_SESION };

export function opcionesCookie(maxAgeSegundos: number) {
  return {
    httpOnly: true,
    secure: esProduccion,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSegundos,
  };
}

export async function leerToken(): Promise<string | undefined> {
  const almacen = await cookies();
  return almacen.get(COOKIE_SESION)?.value;
}
