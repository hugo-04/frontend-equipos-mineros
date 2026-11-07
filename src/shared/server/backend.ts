import "server-only";
import { backendUrl, TIMEOUT_BACKEND_MS } from "./config";

export interface RespuestaBackend {
  status: number;
  cuerpo: string;
  contentType: string | null;
  retryAfter: string | null;
  traceId: string | null;
}

/** Llama al backend con un timeout. Si el backend se cae o tarda de más, lanza error y quien llama falla cerrado. */
export async function llamarBackend(
  ruta: string,
  init: { metodo: string; token?: string; cuerpo?: string },
): Promise<RespuestaBackend> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_BACKEND_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    if (init.cuerpo !== undefined) headers["Content-Type"] = "application/json";
    const respuesta = await fetch(`${backendUrl()}/${ruta}`, {
      method: init.metodo,
      headers,
      body: init.cuerpo,
      cache: "no-store",
      redirect: "manual", // nunca seguir redirecciones hacia otros hosts
      signal: controlador.signal,
    });
    return {
      status: respuesta.status,
      cuerpo: respuesta.status === 204 ? "" : await respuesta.text(),
      contentType: respuesta.headers.get("content-type"),
      retryAfter: respuesta.headers.get("retry-after"),
      traceId: respuesta.headers.get("x-trace-id"),
    };
  } finally {
    clearTimeout(temporizador);
  }
}
