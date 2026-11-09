import type { ApiEquipo, ApiEquipoRequest, ApiEquipoUpdateRequest } from "@/shared/types";

/** El equipo que devuelve el API. Sale del contrato (EquipoResponse): no se escribe a mano. */
export type Equipo = ApiEquipo;

/** El cuerpo para crear un equipo (el EquipoRequest del contrato). */
export type CrearEquipoRequest = ApiEquipoRequest;

/** El cuerpo para editarlo (el EquipoUpdateRequest): sin tipoId, porque el tipo no se puede cambiar. */
export type EditarEquipoRequest = ApiEquipoUpdateRequest;
