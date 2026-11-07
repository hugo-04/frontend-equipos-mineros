import type { components } from "./api.generated";

/** Tipos base derivados del contrato OpenAPI del backend (api.generated.ts no se edita a mano). */
export type ApiErrorResponse = components["schemas"]["ErrorResponse"];
export type ApiErrorDetail = components["schemas"]["ErrorDetail"];
export type LoginResponse = components["schemas"]["LoginResponse"];

/** Metadatos de paginación comunes a todos los listados del backend. */
export type PaginaBase = components["schemas"]["PaginaBase"];

export type Pagina<T> = PaginaBase & { content: T[] };

/** Parámetros de paginación (page desde 1; size de 1 a 100). */
export interface ParametrosPagina {
  page?: number;
  size?: number;
}
