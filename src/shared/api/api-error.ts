import { z } from "zod";
import type { ApiErrorDetail } from "@/shared/types";

/** Forma del ErrorResponse del backend. `traceId` y `details` son opcionales (compatibilidad hacia atrás). */
export const errorResponseSchema = z.object({
  timestamp: z.string().optional(),
  status: z.number(),
  error: z.string().optional(),
  code: z.string().default("ERROR"),
  message: z.string().default(""),
  path: z.string().optional(),
  traceId: z.string().optional(),
  details: z
    .array(
      z.object({
        field: z.string(),
        // El contrato actual usa `reason`; se tolera `message` por si el backend lo renombra
        reason: z.string().optional(),
        message: z.string().optional(),
      }),
    )
    .optional(),
});

export type CategoriaError =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "rateLimited"
  | "system"
  | "network";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly traceId?: string;
  readonly retryAfterSegundos?: number;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    traceId?: string;
    retryAfterSegundos?: number;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.traceId = init.traceId;
    this.retryAfterSegundos = init.retryAfterSegundos;
  }
}

/** Convierte el cuerpo de error del backend en un ApiError; si no se reconoce, es un error de sistema. */
export function apiErrorDesdeRespuesta(
  status: number,
  cuerpo: unknown,
  retryAfter?: string | null,
): ApiError {
  const parsed = errorResponseSchema.safeParse(cuerpo);
  const segundos = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : undefined;
  if (!parsed.success) {
    return new ApiError({ status, code: "RESPUESTA_INVALIDA", message: "", retryAfterSegundos: segundos });
  }
  const e = parsed.data;
  return new ApiError({
    status,
    code: e.code,
    message: e.message,
    traceId: e.traceId,
    retryAfterSegundos: segundos,
    details: (e.details ?? []).map((d) => ({ field: d.field, reason: d.reason ?? d.message ?? "" })),
  });
}

/** La respuesta no cumple el contrato (falla la validación con Zod) o no llegó: se trata como error de sistema. */
export class RespuestaInvalidaError extends ApiError {
  constructor() {
    super({ status: 502, code: "RESPUESTA_INVALIDA", message: "La respuesta del servidor no es válida" });
    this.name = "RespuestaInvalidaError";
  }
}

export class ErrorDeRed extends Error {
  constructor() {
    super("No se pudo conectar con el servidor");
    this.name = "ErrorDeRed";
  }
}

export function classifyError(error: unknown): CategoriaError {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
      case 413:
      case 422:
        return "validation";
      case 401:
        return "unauthorized";
      case 403:
        return "forbidden";
      case 404:
        return "notFound";
      case 409:
        return "conflict";
      case 429:
        return "rateLimited";
      default:
        return "system";
    }
  }
  if (error instanceof ErrorDeRed) return "network";
  return "system";
}
