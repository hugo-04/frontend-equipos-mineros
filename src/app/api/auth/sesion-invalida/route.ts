import { NextResponse, type NextRequest } from "next/server";
import { rutaInternaSegura } from "@/shared/lib/ruta-segura";
import { CABECERAS_NO_STORE } from "@/shared/server/respuestas";
import { COOKIE_SESION, opcionesCookie } from "@/shared/server/session";

/**
 * Falla cerrado: cuando el layout no puede validar la sesión (vencida o backend caído) redirige aquí.
 * Borra la cookie y manda al login; así nunca hay un bucle /login -> /equipos -> /login.
 * Solo borra una cookie: no hace nada que un atacante pueda aprovechar con un GET.
 */
export function GET(request: NextRequest): NextResponse {
  const from = rutaInternaSegura(request.nextUrl.searchParams.get("from"));
  const destino = new URL("/login", request.url);
  destino.searchParams.set("from", from);
  destino.searchParams.set("expirada", "1");
  const salida = NextResponse.redirect(destino, { status: 303, headers: CABECERAS_NO_STORE });
  salida.cookies.set(COOKIE_SESION, "", { ...opcionesCookie(0), maxAge: 0 });
  return salida;
}
