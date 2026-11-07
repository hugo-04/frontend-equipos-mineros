import { NextResponse, type NextRequest } from "next/server";
import { origenPermitido } from "@/shared/server/origin";
import { CABECERAS_NO_STORE, errorJson } from "@/shared/server/respuestas";
import { COOKIE_SESION, opcionesCookie } from "@/shared/server/session";

/** Cierra la sesión borrando la cookie. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!origenPermitido(request.headers, request.url)) {
    return errorJson(403, "ORIGEN_NO_PERMITIDO", "Origen no permitido", "/api/auth/logout");
  }
  const salida = NextResponse.json({ ok: true }, { headers: CABECERAS_NO_STORE });
  salida.cookies.set(COOKIE_SESION, "", { ...opcionesCookie(0), maxAge: 0 });
  return salida;
}
