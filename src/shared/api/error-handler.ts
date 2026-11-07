import { toast } from "sonner";
import { ApiError, classifyError } from "./api-error";

/** Mensaje genérico de sistema: nunca se muestran trazas ni detalles técnicos (A10). */
export const MENSAJE_SISTEMA = "Algo salió mal de nuestro lado. Inténtalo de nuevo.";

export interface DetalleCampo {
  campo: string;
  mensaje: string;
}

/** Mapea `details[]` del backend a los campos del formulario; devuelve también lo que no tiene campo. */
export function mapearDetalles(
  error: ApiError,
  camposDelFormulario: readonly string[],
): { enCampos: DetalleCampo[]; sueltos: string[] } {
  const enCampos: DetalleCampo[] = [];
  const sueltos: string[] = [];
  for (const d of error.details) {
    const razon = d.reason || error.message;
    if (camposDelFormulario.includes(d.field)) enCampos.push({ campo: d.field, mensaje: razon });
    else if (razon) sueltos.push(razon);
  }
  return { enCampos, sueltos };
}

export interface OpcionesManejo {
  /** Campos que existen en el formulario (para mapear details[].field) */
  campos?: readonly string[];
  /** Pone el error junto al campo (react-hook-form `setError`) */
  ponerErrorEnCampo?: (campo: string, mensaje: string) => void;
  /** Campo a marcar en un 409 (por ejemplo "codigo" cuando el código ya existe) */
  campoConflicto?: string;
  /** Acción “Reintentar” para errores de sistema o de red */
  reintentar?: () => void;
  /** Se invoca en un 404 para refrescar la lista */
  alNoEncontrado?: () => void;
}

function conTraza(error: unknown): string | undefined {
  return error instanceof ApiError && error.traceId
    ? `Código de error: ${error.traceId}`
    : undefined;
}

/**
 * Único lugar que traduce errores del API a notificaciones. Lo usan los `onError` de todas las mutaciones.
 */
export function handleMutationError(error: unknown, opciones: OpcionesManejo = {}): void {
  const categoria = classifyError(error);
  const api = error instanceof ApiError ? error : null;

  switch (categoria) {
    case "validation": {
      const { enCampos, sueltos } = mapearDetalles(api as ApiError, opciones.campos ?? []);
      enCampos.forEach((d) => opciones.ponerErrorEnCampo?.(d.campo, d.mensaje));
      if (api?.status === 413) {
        toast.warning("Los datos enviados son demasiado grandes");
      } else if (enCampos.length > 0 && sueltos.length === 0) {
        toast.warning("Revisa los campos marcados");
      } else {
        toast.warning(sueltos[0] ?? api?.message ?? "Revisa los datos ingresados");
      }
      return;
    }
    case "conflict": {
      const mensaje = api?.message || "Ya existe un registro con esos datos";
      if (opciones.campoConflicto) opciones.ponerErrorEnCampo?.(opciones.campoConflicto, mensaje);
      toast.warning(mensaje);
      return;
    }
    case "notFound":
      toast.info(api?.message || "El registro ya no existe");
      opciones.alNoEncontrado?.();
      return;
    case "unauthorized":
      // El cliente HTTP ya limpió el caché y redirige al login; aquí no se duplica el aviso
      return;
    case "forbidden":
      toast.error("No tienes permiso para esta acción");
      return;
    case "rateLimited": {
      const espera = api?.retryAfterSegundos;
      toast.warning(
        espera
          ? `Demasiados intentos. Espera ${Math.ceil(espera / 60)} min e inténtalo de nuevo.`
          : "Demasiados intentos. Espera un momento.",
      );
      return;
    }
    case "network":
    case "system":
    default:
      toast.error(MENSAJE_SISTEMA, {
        description: conTraza(error),
        action: opciones.reintentar
          ? { label: "Reintentar", onClick: opciones.reintentar }
          : undefined,
      });
  }
}
