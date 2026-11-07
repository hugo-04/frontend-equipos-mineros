import { peticion } from "@/shared/api/http";
import { obtenerTodasLasPaginas } from "@/shared/api/paginacion";
import { idSchema } from "@/shared/schemas/pagina";
import { crearEquipoFormSchema, equipoSchema, paginaEquiposSchema } from "../schemas/equipo.schema";
import type { Equipo, EquipoRequest } from "../types";

export function listarEquipos(signal?: AbortSignal): Promise<Equipo[]> {
  return obtenerTodasLasPaginas((page, size) =>
    peticion(`/equipos?page=${page}&size=${size}`, { esquema: paginaEquiposSchema, signal }),
  );
}

export function obtenerEquipo(id: number, signal?: AbortSignal): Promise<Equipo> {
  const idValido = idSchema.parse(id);
  return peticion(`/equipos/${encodeURIComponent(idValido)}`, { esquema: equipoSchema, signal });
}

/** Valida el cuerpo con el mismo contrato antes de enviarlo (defensa en profundidad) */
function validarCuerpo(cuerpo: EquipoRequest): EquipoRequest {
  const esquema = crearEquipoFormSchema();
  const resultado = esquema.parse({
    codigo: cuerpo.codigo,
    tipoId: String(cuerpo.tipoId),
    horometro: String(cuerpo.horometro),
  });
  return resultado;
}

export function crearEquipo(cuerpo: EquipoRequest): Promise<Equipo> {
  return peticion("/equipos", { metodo: "POST", cuerpo: validarCuerpo(cuerpo), esquema: equipoSchema });
}

export function actualizarEquipo(id: number, cuerpo: EquipoRequest): Promise<Equipo> {
  const idValido = idSchema.parse(id);
  return peticion(`/equipos/${encodeURIComponent(idValido)}`, {
    metodo: "PUT",
    cuerpo: validarCuerpo(cuerpo),
    esquema: equipoSchema,
  });
}

export function eliminarEquipo(id: number): Promise<void> {
  const idValido = idSchema.parse(id);
  return peticion(`/equipos/${encodeURIComponent(idValido)}`, { metodo: "DELETE" });
}
