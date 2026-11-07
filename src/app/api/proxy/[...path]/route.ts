import { NextResponse, type NextRequest } from "next/server";
import { tokenVigente } from "@/shared/lib/jwt-claims";
import { llamarBackend } from "@/shared/server/backend";
import { CUERPO_MAX_BYTES } from "@/shared/server/config";
import { registrar } from "@/shared/server/logger";
import { origenPermitido } from "@/shared/server/origin";
import { evaluarRuta, METODOS_ESCRITURA } from "@/shared/server/proxy-policy";
import { CABECERAS_NO_STORE, errorJson } from "@/shared/server/respuestas";
import { COOKIE_SESION, opcionesCookie } from "@/shared/server/session";

type Contexto = { params: Promise<{ path: string[] }> };

function borrarCookie(respuesta: NextResponse): NextResponse {
  respuesta.cookies.set(COOKIE_SESION, "", { ...opcionesCookie(0), maxAge: 0 });
  return respuesta;
}

/**
 * Reenvía al backend adjuntando el token de la cookie httpOnly. Nunca reenvía las cookies del navegador,
 * solo habla con BACKEND_URL, solo con rutas de la lista blanca, con timeout y límite de cuerpo.
 */
async function manejar(request: NextRequest, contexto: Contexto): Promise<NextResponse> {
  const { path } = await contexto.params;
  const metodo = request.method;
  const rutaPublica = `/api/proxy/${path.join("/")}`;

  const politica = evaluarRuta(metodo, path, request.nextUrl.searchParams);
  if (!politica.permitido) {
    registrar("warn", "proxy: ruta rechazada", { metodo, motivo: politica.motivo });
    return errorJson(404, "RUTA_NO_ENCONTRADA", "Recurso no encontrado", rutaPublica);
  }

  if (METODOS_ESCRITURA.has(metodo) && !origenPermitido(request.headers, request.url)) {
    registrar("warn", "proxy: escritura con Origin ajeno", { metodo });
    return errorJson(403, "ORIGEN_NO_PERMITIDO", "Origen no permitido", rutaPublica);
  }

  const token = request.cookies.get(COOKIE_SESION)?.value;
  if (!tokenVigente(token)) {
    return borrarCookie(errorJson(401, "NO_AUTENTICADO", "Sesión no válida", rutaPublica));
  }

  let cuerpo: string | undefined;
  if (metodo === "POST" || metodo === "PUT") {
    const declarado = Number(request.headers.get("content-length") ?? "0");
    if (declarado > CUERPO_MAX_BYTES) {
      return errorJson(413, "CUERPO_DEMASIADO_GRANDE", "Cuerpo demasiado grande", rutaPublica);
    }
    cuerpo = await request.text();
    if (cuerpo.length > CUERPO_MAX_BYTES) {
      return errorJson(413, "CUERPO_DEMASIADO_GRANDE", "Cuerpo demasiado grande", rutaPublica);
    }
  }

  let respuesta;
  try {
    respuesta = await llamarBackend(`${politica.ruta}${politica.query}`, { metodo, token, cuerpo });
  } catch (error) {
    const agotado = error instanceof Error && error.name === "AbortError";
    registrar("error", agotado ? "proxy: timeout del backend" : "proxy: backend inaccesible", {
      metodo,
    });
    return errorJson(
      agotado ? 504 : 503,
      "SERVICIO_NO_DISPONIBLE",
      "Servicio no disponible",
      rutaPublica,
    );
  }

  if (respuesta.status === 401) {
    registrar("warn", "proxy: el backend rechazó el token", {
      traceId: respuesta.traceId ?? undefined,
    });
  } else if (respuesta.status === 403) {
    registrar("warn", "proxy: acceso denegado", {
      metodo,
      traceId: respuesta.traceId ?? undefined,
    });
  } else if (respuesta.status >= 500) {
    registrar("error", "proxy: error del backend", {
      status: respuesta.status,
      traceId: respuesta.traceId ?? undefined,
    });
  }

  const headers: Record<string, string> = { ...CABECERAS_NO_STORE };
  if (respuesta.contentType?.includes("json")) headers["Content-Type"] = "application/json";
  if (respuesta.retryAfter) headers["Retry-After"] = respuesta.retryAfter;
  if (respuesta.traceId) headers["X-Trace-Id"] = respuesta.traceId;

  const salida = new NextResponse(respuesta.status === 204 ? null : respuesta.cuerpo, {
    status: respuesta.status,
    headers,
  });
  return respuesta.status === 401 ? borrarCookie(salida) : salida;
}

export const GET = manejar;
export const POST = manejar;
export const PUT = manejar;
export const DELETE = manejar;
