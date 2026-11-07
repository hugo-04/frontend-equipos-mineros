import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Sirve para verificar el despliegue: dice que el frontend responde y qué versión es (el tag de la imagen), que
 * deploy-frontend.sh compara con la que acaba de desplegar. No toca el backend ni devuelve datos.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    { status: "UP", version: process.env.APP_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
