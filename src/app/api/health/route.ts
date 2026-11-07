import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Para verificar el despliegue: solo dice que el frontend responde (no toca el backend ni expone datos). */
export function GET(): NextResponse {
  return NextResponse.json({ status: "UP" }, { headers: { "Cache-Control": "no-store" } });
}
