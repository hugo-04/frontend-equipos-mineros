/**
 * Lee los datos de un JWT sin verificar la firma. Solo sirve para saber cuándo vence (y darle esa duración a la
 * cookie) y para mostrar usuario y rol. Quien decide de verdad si el token vale es el backend: esto nunca se usa
 * para autorizar. Usa atob, así que también corre en el runtime Edge.
 */
export interface ClaimsJwt {
  sub?: string;
  rol?: string;
  exp?: number;
}

export function leerClaims(token: string): ClaimsJwt | null {
  const partes = token.split(".");
  const payload = partes[1];
  if (partes.length !== 3 || !payload) return null;
  try {
    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const binario = atob(base64);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const datos: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof datos !== "object" || datos === null) return null;
    const d = datos as Record<string, unknown>;
    return {
      sub: typeof d.sub === "string" ? d.sub : undefined,
      rol: typeof d.rol === "string" ? d.rol : undefined,
      exp: typeof d.exp === "number" ? d.exp : undefined,
    };
  } catch {
    return null;
  }
}

/** Un token ilegible o vencido (con 5 segundos de margen) se trata como si no existiera. */
export function tokenVigente(token: string | undefined, ahoraMs: number = Date.now()): boolean {
  if (!token) return false;
  const claims = leerClaims(token);
  if (!claims?.exp) return false;
  return claims.exp * 1000 > ahoraMs + 5_000;
}
