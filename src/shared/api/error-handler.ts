import { toast } from "sonner";
import { ApiError, classifyError } from "./api-error";

/** Lo que ve el usuario cuando algo falla de nuestro lado. Nunca lleva trazas ni detalles técnicos. */
export const MENSAJE_SISTEMA = "Algo salió mal de nuestro lado. Inténtalo de nuevo.";

/**
 * Errores de negocio (422) que el backend manda con un código y sin detalle por campo, pero que tienen un campo
 * claro en el formulario. Con esto el mensaje queda junto al campo y no solo en el toast.
 * TIPO_NO_MODIFICABLE no está acá a propósito: el formulario de edición no tiene campo de tipo, así que va como aviso.
 */
const CAMPO_POR_CODIGO: Readonly<Record<string, string>> = {
  HOROMETRO_NO_PUEDE_BAJAR: "horometro",
  HOROMETRO_INVALIDO: "horometro",
};

export interface DetalleCampo {
  campo: string;
  mensaje: string;
}

/** Reparte los `details[]` del backend: los que corresponden a un campo del formulario van junto al campo y el resto se devuelve aparte, para el toast. */
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
  /** Los campos que tiene el formulario, para saber a cuáles se les puede poner el error. */
  campos?: readonly string[];
  /** Marca el error en el campo (es el setError de react-hook-form). */
  ponerErrorEnCampo?: (campo: string, mensaje: string) => void;
  /** Qué campo marcar cuando hay un 409, por ejemplo "codigo" si el código ya existe. */
  campoConflicto?: string;
  /** Si se pasa, el toast de error trae un botón "Reintentar". */
  reintentar?: () => void;
  /** Qué hacer ante un 404; normalmente refrescar la lista, porque el registro ya no está. */
  alNoEncontrado?: () => void;
}

function conTraza(error: unknown): string | undefined {
  return error instanceof ApiError && error.traceId
    ? `Código de error: ${error.traceId}`
    : undefined;
}

/**
 * El único lugar donde un error del API se convierte en un aviso para el usuario. Lo usan los onError de todas
 * las mutaciones, así no hay try/catch ni toasts sueltos repartidos por los componentes.
 */
export function handleMutationError(error: unknown, opciones: OpcionesManejo = {}): void {
  const categoria = classifyError(error);
  const api = error instanceof ApiError ? error : null;

  switch (categoria) {
    case "validation": {
      const { enCampos, sueltos } = mapearDetalles(api as ApiError, opciones.campos ?? []);
      enCampos.forEach((d) => opciones.ponerErrorEnCampo?.(d.campo, d.mensaje));
      const campoDelCodigo = api ? CAMPO_POR_CODIGO[api.code] : undefined;
      if (campoDelCodigo && opciones.campos?.includes(campoDelCodigo)) {
        opciones.ponerErrorEnCampo?.(campoDelCodigo, api?.message || "Revisa este campo");
      }
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
      // El cliente HTTP ya limpió el caché y está mandando al login; acá no se vuelve a avisar
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
