import type { Pagina } from "@/shared/types";

const TAMANO_MAXIMO = 100;
const PAGINAS_MAXIMAS = 50; // tope de seguridad: 5000 registros

/**
 * El backend pagina (máx. 100 por página). Para las pantallas que filtran en el cliente se piden todas las
 * páginas; el tope evita un bucle si el servidor respondiera algo incoherente.
 */
export async function obtenerTodasLasPaginas<T>(
  cargar: (page: number, size: number) => Promise<Pagina<T>>,
): Promise<T[]> {
  const acumulado: T[] = [];
  for (let page = 1; page <= PAGINAS_MAXIMAS; page++) {
    const resultado = await cargar(page, TAMANO_MAXIMO);
    acumulado.push(...resultado.content);
    if (resultado.last || resultado.content.length === 0) break;
  }
  return acumulado;
}
