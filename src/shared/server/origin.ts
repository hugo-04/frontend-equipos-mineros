/**
 * Protección contra CSRF: en cualquier escritura (POST, PUT, DELETE) el header Origin tiene que ser el host de esta
 * app. También vale el host que reenvía el proxy del hosting (x-forwarded-host), que es el que pone el HTTPS.
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
