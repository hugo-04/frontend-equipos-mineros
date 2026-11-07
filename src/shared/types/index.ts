import type { components } from "./api.generated";

/** Tipos que salen del contrato OpenAPI del backend. El api.generated.ts se genera, no se edita a mano. */
export type ApiErrorResponse = components["schemas"]["ErrorResponse"];
export type ApiErrorDetail = components["schemas"]["ErrorDetail"];
export type LoginResponse = components["schemas"]["LoginResponse"];

/** Los datos de paginación que comparten todos los listados del backend. */
export type PaginaBase = components["schemas"]["PaginaBase"];

export type Pagina<T> = PaginaBase & { content: T[] };

/** Parámetros de paginación: page desde 0 (como Spring Data) y size de 1 a 100. */
export interface ParametrosPagina {
  page?: number;
  size?: number;
}
