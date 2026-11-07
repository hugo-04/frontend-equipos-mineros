/**
 * La lista blanca de rutas que el proxy deja pasar al backend; lo que no esté acá se rechaza. Además se revisa cada
 * tramo del path y se rechazan `..`, `//`, `\`, `%`, esquemas y hosts que mande el usuario, para que nadie use el
 * proxy para llegar a otra ruta o a otro servidor (path traversal y SSRF).
 */
type Metodo = "GET" | "POST" | "PUT" | "DELETE";

const REGLAS: { metodo: Metodo; patron: RegExp }[] = [
  { metodo: "GET", patron: /^tipos$/ },
  { metodo: "GET", patron: /^equipos$/ },
  { metodo: "POST", patron: /^equipos$/ },
  { metodo: "GET", patron: /^equipos\/[1-9]\d{0,17}$/ },
  { metodo: "PUT", patron: /^equipos\/[1-9]\d{0,17}$/ },
  { metodo: "DELETE", patron: /^equipos\/[1-9]\d{0,17}$/ },
  { metodo: "GET", patron: /^equipos\/[1-9]\d{0,17}\/mantenimientos$/ },
  { metodo: "POST", patron: /^equipos\/[1-9]\d{0,17}\/mantenimientos$/ },
];

export type ResultadoPolitica =
  { permitido: true; ruta: string; query: string } | { permitido: false; motivo: string };

export const METODOS_ESCRITURA = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/** De la query solo pasan page y size, y solo si son números cortos. Todo lo demás se descarta. */
export function sanearQuery(params: URLSearchParams): string {
  const salida = new URLSearchParams();
  for (const clave of ["page", "size"] as const) {
    const valor = params.get(clave);
    if (valor !== null && /^\d{1,4}$/.test(valor)) salida.set(clave, valor);
  }
  const texto = salida.toString();
  return texto ? `?${texto}` : "";
}

export function evaluarRuta(
  metodo: string,
  segmentos: readonly string[],
  params: URLSearchParams,
): ResultadoPolitica {
  if (segmentos.length === 0 || segmentos.length > 4)
    return { permitido: false, motivo: "ruta fuera de la lista" };
  for (const s of segmentos) {
    if (s === "" || s === "." || s === ".." || /[\\/%:?#@\u0000-\u001f\u007f]/.test(s)) {
      return { permitido: false, motivo: "segmento sospechoso" };
    }
  }
  const ruta = segmentos.join("/");
  const regla = REGLAS.find((r) => r.metodo === metodo && r.patron.test(ruta));
  if (!regla) return { permitido: false, motivo: "ruta o método no permitido" };
  return { permitido: true, ruta, query: sanearQuery(params) };
}
