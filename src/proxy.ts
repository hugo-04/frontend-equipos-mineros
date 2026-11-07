import { NextResponse, type NextRequest } from "next/server";
import { tokenVigente } from "@/shared/lib/jwt-claims";
import { rutaInternaSegura } from "@/shared/lib/ruta-segura";
import { COOKIE_SESION } from "@/shared/lib/sesion-cookie";
import { construirCsp } from "@/shared/server/security-headers";

/**
 * Convención de Next.js 16: `proxy.ts` reemplaza a `middleware.ts`.
 * Primera defensa de las rutas protegidas (la segunda es la validación en el layout (protected)) y
 * generador de la CSP con nonce por petición.
 */
const RUTAS_PUBLICAS = new Set([
  "/login",
  "/api/health",
  "/api/auth/login",
  "/api/auth/sesion-invalida",
]);

function conSeguridad(respuesta: NextResponse, csp: string, esApi: boolean): NextResponse {
  respuesta.headers.set("Content-Security-Policy", csp);
  if (esApi) respuesta.headers.set("Cache-Control", "no-store");
  return respuesta;
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = construirCsp(nonce, process.env.NODE_ENV === "production");
  const { pathname, search } = request.nextUrl;
  const esApi = pathname.startsWith("/api/");
  const autenticado = tokenVigente(request.cookies.get(COOKIE_SESION)?.value);

  if (pathname === "/login" && autenticado) {
    return conSeguridad(NextResponse.redirect(new URL("/equipos", request.url)), csp, false);
  }

  if (!RUTAS_PUBLICAS.has(pathname) && !autenticado) {
    if (esApi) {
      const sinSesion = NextResponse.json(
        {
          status: 401,
          code: "NO_AUTENTICADO",
          message: "Sesión no válida",
          path: pathname,
          details: [],
        },
        { status: 401 },
      );
      return conSeguridad(sinSesion, csp, true);
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", rutaInternaSegura(pathname + search));
    return conSeguridad(NextResponse.redirect(login), csp, false);
  }

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-ruta", rutaInternaSegura(pathname + search)); // para que el layout sepa a dónde volver
  headers.set("Content-Security-Policy", csp);
  return conSeguridad(NextResponse.next({ request: { headers } }), csp, esApi);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
