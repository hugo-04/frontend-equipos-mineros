import type { Pagina } from "@/shared/types";

const TAMANO_MAXIMO = 100;
const PAGINAS_MAXIMAS = 50; // tope de seguridad: 5000 registros

/**
 * Pide todas las páginas del backend (máximo 100 por página, la primera es la 0) y las junta. Se hace así porque
 * la búsqueda y los filtros de equipos se aplican en el cliente. El tope de páginas evita un bucle si el servidor
 * responde algo incoherente.
 */
export async function obtenerTodasLasPaginas<T>(
  cargar: (page: number, size: number) => Promise<Pagina<T>>,
): Promise<T[]> {
  const acumulado: T[] = [];
  for (let page = 0; page < PAGINAS_MAXIMAS; page++) {
    const resultado = await cargar(page, TAMANO_MAXIMO);
    acumulado.push(...resultado.content);
    if (resultado.last || resultado.content.length === 0) break;
  }
  return acumulado;
}
