import "server-only";

/** BACKEND_URL es una variable SOLO de servidor (sin NEXT_PUBLIC_): el navegador nunca la conoce. */
export function backendUrl(): string {
  const valor = process.env.BACKEND_URL?.trim();
  if (!valor) throw new Error("Falta la variable de entorno BACKEND_URL");
  const url = new URL(valor);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("BACKEND_URL debe ser http(s)");
  return url.origin + url.pathname.replace(/\/+$/, "");
}

export const esProduccion = process.env.NODE_ENV === "production";

export const TIMEOUT_BACKEND_MS = 10_000;
export const CUERPO_MAX_BYTES = 16 * 1024;
