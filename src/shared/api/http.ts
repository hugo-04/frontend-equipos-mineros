import type { ZodType } from "zod";
import { ApiError, ErrorDeRed, RespuestaInvalidaError, apiErrorDesdeRespuesta } from "./api-error";

/**
 * Cliente HTTP base. El navegador solo habla con rutas /api/* de este mismo sitio. El token va en una cookie
 * httpOnly que el servidor de Next adjunta cuando reenvía al backend, así que acá nunca se ve ni se guarda.
 */
const BASE_PROXY = "/api/proxy";
const TIMEOUT_MS = 15_000;

type Handler401 = () => void;
let manejador401: Handler401 | null = null;

/** Lo registra el QueryProvider: ante un 401 limpia el caché, avisa y manda al login, una sola vez. */
export function registrarManejador401(handler: Handler401 | null): void {
  manejador401 = handler;
}

interface OpcionesPeticion<T> {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  cuerpo?: unknown;
  /** Esquema Zod de la respuesta. Si lo que llega no lo cumple, se trata como error de sistema. */
  esquema?: ZodType<T>;
  signal?: AbortSignal;
  /** Para las rutas propias (/api/auth/*), que no pasan por el proxy. */
  rutaPropia?: boolean;
}

export async function peticion<T = void>(
  ruta: string,
  opciones: OpcionesPeticion<T> = {},
): Promise<T> {
  const { metodo = "GET", cuerpo, esquema, signal, rutaPropia = false } = opciones;
  const url = rutaPropia ? ruta : `${BASE_PROXY}${ruta}`;

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => controlador.abort(), { once: true });

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers:
        cuerpo === undefined
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      credentials: "same-origin",
      cache: "no-store",
      signal: controlador.signal,
    });
  } catch {
    throw new ErrorDeRed();
  } finally {
    clearTimeout(temporizador);
  }

  if (respuesta.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await respuesta.json();
  } catch {
    json = null;
  }

  if (!respuesta.ok) {
    const error = apiErrorDesdeRespuesta(
      respuesta.status,
      json,
      respuesta.headers.get("Retry-After"),
    );
    // El login responde 401 cuando las credenciales están mal; eso no quiere decir que la sesión venció
    if (respuesta.status === 401 && !rutaPropia) manejador401?.();
    throw error;
  }

  if (!esquema) return json as T;
  const resultado = esquema.safeParse(json);
  if (!resultado.success) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Respuesta fuera de contrato en", ruta, resultado.error.issues);
    }
    throw new RespuestaInvalidaError();
  }
  return resultado.data;
}

export { ApiError };
