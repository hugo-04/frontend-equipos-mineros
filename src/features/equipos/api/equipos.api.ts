import { peticion } from "@/shared/api/http";
import { obtenerTodasLasPaginas } from "@/shared/api/paginacion";
import { idSchema } from "@/shared/schemas/pagina";
import {
  crearEquipoSchema,
  editarEquipoSchema,
  equipoSchema,
  paginaEquiposSchema,
} from "../schemas/equipo.schema";
import type { CrearEquipoRequest, EditarEquipoRequest, Equipo } from "../types";

/** Trae todos los equipos (junta las páginas que entrega el backend). */
export function listarEquipos(signal?: AbortSignal): Promise<Equipo[]> {
  return obtenerTodasLasPaginas((page, size) =>
    peticion(`/equipos?page=${page}&size=${size}`, { esquema: paginaEquiposSchema, signal }),
  );
}

/** Trae un equipo por id. El id se valida antes de armar la URL. */
export function obtenerEquipo(id: number, signal?: AbortSignal): Promise<Equipo> {
  const idValido = idSchema.parse(id);
  return peticion(`/equipos/${encodeURIComponent(idValido)}`, { esquema: equipoSchema, signal });
}

/** Vuelve a validar el cuerpo con las reglas del formulario antes de enviarlo, por si alguien llama a la API sin pasar por el formulario. */
export function crearEquipo(cuerpo: CrearEquipoRequest): Promise<Equipo> {
  const valido = crearEquipoSchema.parse({
    codigo: cuerpo.codigo,
    tipoId: String(cuerpo.tipoId),
    horometro: String(cuerpo.horometro),
  });
  return peticion("/equipos", { metodo: "POST", cuerpo: valido, esquema: equipoSchema });
}

/**
 * Edita código y horómetro. El cuerpo sale del esquema de edición, que no tiene tipoId: aunque alguien lo
 * cuele en el objeto, no se envía (el backend lo rechazaría con 400).
 */
export function actualizarEquipo(id: number, cuerpo: EditarEquipoRequest): Promise<Equipo> {
  const idValido = idSchema.parse(id);
  const valido = editarEquipoSchema().parse({
    codigo: cuerpo.codigo,
    horometro: String(cuerpo.horometro),
  });
  return peticion(`/equipos/${encodeURIComponent(idValido)}`, {
    metodo: "PUT",
    cuerpo: valido,
    esquema: equipoSchema,
  });
}

/** Elimina el equipo; el backend borra también su historial de mantenimientos. */
export function eliminarEquipo(id: number): Promise<void> {
  const idValido = idSchema.parse(id);
  return peticion(`/equipos/${encodeURIComponent(idValido)}`, { metodo: "DELETE" });
}
