import type { components } from "./api.generated";

/** Tipos que salen del contrato OpenAPI del backend. El api.generated.ts se genera, no se edita a mano. */
export type ApiErrorResponse = components["schemas"]["ErrorResponse"];
export type ApiErrorDetail = components["schemas"]["ErrorDetail"];
export type LoginResponse = components["schemas"]["LoginResponse"];

/** Los cuerpos del contrato que usa el frontend. Cambian solos al regenerar los tipos (npm run contrato:copiar). */
export type ApiTipoEquipo = components["schemas"]["TipoEquipoResponse"];
export type ApiEquipo = components["schemas"]["EquipoResponse"];
export type ApiEquipoRequest = components["schemas"]["EquipoRequest"];
export type ApiEquipoUpdateRequest = components["schemas"]["EquipoUpdateRequest"];
export type ApiMantenimiento = components["schemas"]["MantenimientoResponse"];
export type ApiMantenimientoRequest = components["schemas"]["MantenimientoRequest"];
export type ApiLoginRequest = components["schemas"]["LoginRequest"];
export type ApiHealth = components["schemas"]["HealthResponse"];

/**
 * Para exigir, al compilar, que un esquema de Zod tenga exactamente los campos y tipos del contrato:
 * `type X = Verificar<Coinciden<z.output<typeof esquema>, ApiAlgo>>` no compila si no coinciden.
 */
export type Coinciden<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type Verificar<T extends true> = T;

/** Los datos de paginación que comparten todos los listados del backend. */
export type PaginaBase = components["schemas"]["PaginaBase"];

export type Pagina<T> = PaginaBase & { content: T[] };

/** Parámetros de paginación: page desde 0 (como Spring Data) y size de 1 a 100. */
export interface ParametrosPagina {
  page?: number;
  size?: number;
}
