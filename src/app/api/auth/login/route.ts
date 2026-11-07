import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loginSchema } from "@/features/auth/schemas/login.schema";
import { leerClaims } from "@/shared/lib/jwt-claims";
import { llamarBackend } from "@/shared/server/backend";
import { CUERPO_MAX_BYTES } from "@/shared/server/config";
import { registrar } from "@/shared/server/logger";
import { origenPermitido } from "@/shared/server/origin";
import { ipDelCliente, limitadorLogin } from "@/shared/server/rate-limit";
import { CABECERAS_NO_STORE, errorJson } from "@/shared/server/respuestas";
import { COOKIE_SESION, opcionesCookie } from "@/shared/server/session";

const RUTA = "/api/auth/login";
const respuestaBackendSchema = z.object({ accessToken: z.string().min(20), expiresIn: z.number().positive() });

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!origenPermitido(request.headers, request.url)) {
    registrar("warn", "login: origen no permitido");
    return errorJson(403, "ORIGEN_NO_PERMITIDO", "Origen no permitido", RUTA);
  }

  const ip = ipDelCliente(request.headers);
  const espera = limitadorLogin.bloqueadoPor(ip);
  if (espera > 0) {
    registrar("warn", "login: bloqueado por exceso de intentos", { ip });
    return errorJson(429, "DEMASIADOS_INTENTOS", "Demasiados intentos. Inténtalo más tarde.", RUTA, {
      "Retry-After": String(espera),
    });
  }

  const texto = await request.text();
  if (texto.length > CUERPO_MAX_BYTES) return errorJson(413, "CUERPO_DEMASIADO_GRANDE", "Cuerpo demasiado grande", RUTA);

  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return errorJson(400, "JSON_INVALIDO", "El cuerpo no es un JSON válido", RUTA);
  }
  const validado = loginSchema.safeParse(datos);
  if (!validado.success) {
    const detalles = validado.error.issues.map((i) => ({ field: String(i.path[0] ?? ""), reason: i.message }));
    return errorJson(400, "VALIDACION_FALLIDA", "Revisa los campos marcados", RUTA, {}, detalles);
  }

  let respuesta;
  try {
    respuesta = await llamarBackend("auth/login", { metodo: "POST", cuerpo: JSON.stringify(validado.data) });
  } catch {
    registrar("error", "login: el backend no respondió");
    return errorJson(503, "SERVICIO_NO_DISPONIBLE", "Servicio no disponible", RUTA);
  }

  if (respuesta.status === 200) {
    let json: unknown;
    try {
      json = JSON.parse(respuesta.cuerpo);
    } catch {
      json = null;
    }
    const sesion = respuestaBackendSchema.safeParse(json);
    if (!sesion.success) {
      registrar("error", "login: respuesta del backend fuera de contrato", { traceId: respuesta.traceId ?? undefined });
      return errorJson(502, "RESPUESTA_INVALIDA", "Respuesta inválida del servidor", RUTA);
    }
    limitadorLogin.reiniciar(ip);
    const claims = leerClaims(sesion.data.accessToken);
    // La cookie nunca dura más que el token
    const segundosPorExp = claims?.exp ? Math.floor(claims.exp - Date.now() / 1000) : sesion.data.expiresIn;
    const maxAge = Math.max(1, Math.min(sesion.data.expiresIn, segundosPorExp));
    const salida = NextResponse.json(
      { ok: true, usuario: { username: claims?.sub ?? validado.data.username, rol: claims?.rol } },
      { headers: CABECERAS_NO_STORE },
    );
    // El token solo viaja en esta cookie httpOnly; el cuerpo que ve el navegador no lo incluye
    salida.cookies.set(COOKIE_SESION, sesion.data.accessToken, opcionesCookie(maxAge));
    return salida;
  }

  // Cualquier respuesta que no sea 200 cuenta como fallo; el mensaje del backend ya es genérico
  if (respuesta.status === 401) {
    limitadorLogin.registrarFallo(ip);
    registrar("warn", "login: credenciales rechazadas", { ip, traceId: respuesta.traceId ?? undefined });
  } else if (respuesta.status >= 500) {
    registrar("error", "login: error del backend", { status: respuesta.status, traceId: respuesta.traceId ?? undefined });
  }
  const extra: Record<string, string> = { ...CABECERAS_NO_STORE };
  if (respuesta.retryAfter) extra["Retry-After"] = respuesta.retryAfter;
  return new NextResponse(respuesta.cuerpo, {
    status: respuesta.status,
    headers: { ...extra, "Content-Type": respuesta.contentType?.includes("json") ? "application/json" : "text/plain" },
  });
}
