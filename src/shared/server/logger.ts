import "server-only";

/** Deja en el log del servidor los eventos de seguridad (login fallido, 401, 403, 5xx). Nunca credenciales ni tokens. */
type Nivel = "info" | "warn" | "error";

const limpiar = (v: string) => v.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200);

export function registrar(
  nivel: Nivel,
  evento: string,
  datos: Record<string, string | number | undefined> = {},
): void {
  const linea = Object.entries(datos)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${limpiar(String(v))}`)
    .join(" ");
  const mensaje = `[seguridad] ${evento}${linea ? " " + linea : ""}`;
  if (nivel === "error") console.error(mensaje);
  else if (nivel === "warn") console.warn(mensaje);
  else console.info(mensaje);
}
