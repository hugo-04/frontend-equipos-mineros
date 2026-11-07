/**
 * A01: el parámetro `from` del login solo puede ser una ruta relativa interna.
 * Evita redirecciones abiertas: rechaza `//evil.com`, `https://…`, `/\evil`, esquemas y caracteres de control.
 */
export function rutaInternaSegura(valor: string | null | undefined, porDefecto = "/equipos"): string {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 200) return porDefecto;
  if (!valor.startsWith("/") || valor.startsWith("//")) return porDefecto;
  if (valor.includes("\\") || /[\u0000-\u001f\u007f]/.test(valor)) return porDefecto;
  // Un esquema (javascript:, https:) o un host nunca puede aparecer antes del primer "/"
  try {
    const base = "http://interno.invalid";
    const url = new URL(valor, base);
    if (url.origin !== base) return porDefecto;
    // Nunca volver a las pantallas de autenticación ni a la API
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/api")) return porDefecto;
    return url.pathname + url.search;
  } catch {
    return porDefecto;
  }
}
