import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Sirve para verificar el despliegue: solo dice que el frontend responde. No toca el backend ni devuelve datos. */
export function GET(): NextResponse {
  return NextResponse.json({ status: "UP" }, { headers: { "Cache-Control": "no-store" } });
}
