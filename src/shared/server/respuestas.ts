import { NextResponse } from "next/server";

/** Toda respuesta autenticada o del proxy lleva Cache-Control: no-store, para que nadie cachee datos privados. */
export const CABECERAS_NO_STORE = { "Cache-Control": "no-store" } as const;

/** Un error con la misma forma que el ErrorResponse del backend, pero generado por el propio servidor de Next. */
export function errorJson(
  status: number,
  code: string,
  message: string,
  path: string,
  extra: Record<string, string> = {},
  details: { field: string; reason: string }[] = [],
): NextResponse {
  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      status,
      error: "",
      code,
      message,
      path,
      traceId: crypto.randomUUID(),
      details,
    },
    { status, headers: { ...CABECERAS_NO_STORE, ...extra } },
  );
}
