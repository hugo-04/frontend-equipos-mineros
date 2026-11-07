/**
 * A07 (CSRF): en toda escritura el header Origin debe coincidir con el host de la app.
 * Se acepta el host reenviado por el proxy del hosting (x-forwarded-host) porque es quien termina el TLS.
 */
export function origenPermitido(headers: Headers, urlPeticion: string): boolean {
  const origen = headers.get("origin");
  if (!origen) return false; // los navegadores siempre lo envían en POST/PUT/DELETE desde fetch
  let host: string;
  try {
    host = new URL(origen).host;
  } catch {
    return false;
  }
  const esperados = new Set<string>();
  const reenviado = headers.get("x-forwarded-host");
  if (reenviado) esperados.add((reenviado.split(",")[0] ?? "").trim());
  const propio = headers.get("host");
  if (propio) esperados.add(propio);
  try {
    esperados.add(new URL(urlPeticion).host);
  } catch {
    /* sin URL válida: se queda con los headers */
  }
  return esperados.has(host);
}
