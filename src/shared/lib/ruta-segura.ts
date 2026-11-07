/**
 * Valida el parámetro `from` del login. Solo se acepta una ruta interna de este sitio; con cualquier otra cosa
 * (`//evil.com`, `https://...`, `/\evil`, esquemas raros, caracteres de control) se vuelve a la ruta por defecto.
 * Si no, el login serviría para mandar al usuario a un sitio ajeno (redirección abierta).
 */
export function rutaInternaSegura(
  valor: string | null | undefined,
  porDefecto = "/equipos",
): string {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 200) return porDefecto;
  if (!valor.startsWith("/") || valor.startsWith("//")) return porDefecto;
  if (valor.includes("\\") || /[\u0000-\u001f\u007f]/.test(valor)) return porDefecto;
  // Tampoco se dejan pasar saltos de línea, nulos ni barras invertidas codificados (%0d %0a %00 %5c)
  if (/%(0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(valor)) return porDefecto;
  // Se resuelve contra un origen falso: si el resultado apunta a otro origen, era un host o un esquema disfrazado
  try {
    const base = "http://interno.invalid";
    const url = new URL(valor, base);
    if (url.origin !== base) return porDefecto;
    // No tiene sentido volver al login ni a una ruta de la API
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/api")) return porDefecto;
    return url.pathname + url.search;
  } catch {
    return porDefecto;
  }
}
