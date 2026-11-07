import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  ApiError,
  apiErrorDesdeRespuesta,
  classifyError,
  ErrorDeRed,
  RespuestaInvalidaError,
} from "./api-error";
import { handleMutationError, mapearDetalles, MENSAJE_SISTEMA } from "./error-handler";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

const error = (status: number, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
  new ApiError({ status, code: "X", message: "mensaje del backend", ...extra });

// Cada estado HTTP cae en la categoría que decide qué se le muestra al usuario
describe("classifyError", () => {
  it.each([
    [400, "validation"],
    [422, "validation"],
    [413, "validation"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "notFound"],
    [409, "conflict"],
    [429, "rateLimited"],
    [500, "system"],
    [503, "system"],
  ])("el estado %i es %s", (status, esperado) => {
    expect(classifyError(error(status))).toBe(esperado);
  });

  it("clasifica red caída, respuesta inválida y errores desconocidos", () => {
    expect(classifyError(new ErrorDeRed())).toBe("network");
    expect(classifyError(new RespuestaInvalidaError())).toBe("system");
    expect(classifyError(new Error("boom"))).toBe("system");
    expect(classifyError("texto")).toBe("system");
  });
});

// Se lee el ErrorResponse del backend y se tolera que falten los campos opcionales
describe("apiErrorDesdeRespuesta", () => {
  it("lee el ErrorResponse del backend con details[].reason y traceId", () => {
    const e = apiErrorDesdeRespuesta(400, {
      status: 400,
      code: "VALIDACION_FALLIDA",
      message: "Revisa",
      traceId: "abc-123",
      details: [{ field: "codigo", reason: "muy corto" }],
    });
    expect(e.code).toBe("VALIDACION_FALLIDA");
    expect(e.traceId).toBe("abc-123");
    expect(e.details).toEqual([{ field: "codigo", reason: "muy corto" }]);
  });

  it("tolera que falten traceId y details, y que el detalle venga como message", () => {
    const e = apiErrorDesdeRespuesta(409, {
      status: 409,
      code: "CODIGO_DUPLICADO",
      message: "duplicado",
    });
    expect(e.traceId).toBeUndefined();
    expect(e.details).toEqual([]);
    const f = apiErrorDesdeRespuesta(400, {
      status: 400,
      code: "V",
      message: "m",
      details: [{ field: "a", message: "b" }],
    });
    expect(f.details[0]?.reason).toBe("b");
  });

  it("lee Retry-After del 429", () => {
    expect(
      apiErrorDesdeRespuesta(429, { status: 429, code: "DEMASIADOS_INTENTOS", message: "x" }, "300")
        .retryAfterSegundos,
    ).toBe(300);
    expect(apiErrorDesdeRespuesta(429, null, "abc").retryAfterSegundos).toBeUndefined();
  });

  it("un cuerpo irreconocible es un error de sistema con código propio", () => {
    const e = apiErrorDesdeRespuesta(502, "<html>bad gateway</html>");
    expect(e.code).toBe("RESPUESTA_INVALIDA");
    expect(e.message).toBe("");
  });
});

// Los errores con campo van junto al campo; los demás, al toast
describe("mapearDetalles", () => {
  it("separa lo que tiene campo en el formulario de lo que no", () => {
    const e = error(400, {
      details: [
        { field: "codigo", reason: "inválido" },
        { field: "otro", reason: "no está en el formulario" },
      ],
    });
    expect(mapearDetalles(e, ["codigo", "horometro"])).toEqual({
      enCampos: [{ campo: "codigo", mensaje: "inválido" }],
      sueltos: ["no está en el formulario"],
    });
  });
});

// Un solo lugar decide qué aviso ve el usuario según el tipo de error
describe("handleMutationError", () => {
  it("validación: marca los campos y avisa con un toast de advertencia", () => {
    const ponerError = vi.fn();
    handleMutationError(error(400, { details: [{ field: "codigo", reason: "muy corto" }] }), {
      campos: ["codigo"],
      ponerErrorEnCampo: ponerError,
    });
    expect(ponerError).toHaveBeenCalledWith("codigo", "muy corto");
    expect(toast.warning).toHaveBeenCalledWith("Revisa los campos marcados");
  });

  it("validación sin campo en el formulario: el mensaje va en el toast", () => {
    handleMutationError(error(400, { details: [{ field: "x", reason: "razón suelta" }] }), {
      campos: ["codigo"],
    });
    expect(toast.warning).toHaveBeenCalledWith("razón suelta");
  });

  it("conflicto: marca el campo y muestra el mensaje del backend", () => {
    const ponerError = vi.fn();
    handleMutationError(error(409, { code: "CODIGO_DUPLICADO", message: "El código ya existe" }), {
      campoConflicto: "codigo",
      ponerErrorEnCampo: ponerError,
    });
    expect(ponerError).toHaveBeenCalledWith("codigo", "El código ya existe");
    expect(toast.warning).toHaveBeenCalledWith("El código ya existe");
  });

  it("no encontrado: informa y refresca la lista", () => {
    const refrescar = vi.fn();
    handleMutationError(error(404), { alNoEncontrado: refrescar });
    expect(toast.info).toHaveBeenCalled();
    expect(refrescar).toHaveBeenCalled();
  });

  it("permisos: toast fijo", () => {
    handleMutationError(error(403));
    expect(toast.error).toHaveBeenCalledWith("No tienes permiso para esta acción");
  });

  it("sistema: mensaje genérico, sin detalles técnicos, con código de rastreo y reintento", () => {
    const reintentar = vi.fn();
    handleMutationError(
      error(500, { message: "NullPointerException en Foo.java:42", traceId: "t-1" }),
      { reintentar },
    );
    const [mensaje, opciones] = vi.mocked(toast.error).mock.calls.at(-1) ?? [];
    expect(mensaje).toBe(MENSAJE_SISTEMA);
    expect(JSON.stringify(opciones)).not.toContain("NullPointer");
    expect(opciones).toMatchObject({
      description: "Código de error: t-1",
      action: { label: "Reintentar" },
    });
  });

  it("red caída: el mismo mensaje genérico", () => {
    handleMutationError(new ErrorDeRed());
    expect(vi.mocked(toast.error).mock.calls.at(-1)?.[0]).toBe(MENSAJE_SISTEMA);
  });

  it("429: avisa cuánto esperar", () => {
    handleMutationError(error(429, { retryAfterSegundos: 300 }));
    expect(vi.mocked(toast.warning).mock.calls.at(-1)?.[0]).toContain("5 min");
  });

  it("401: no duplica el aviso (lo maneja el cliente HTTP)", () => {
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.error).mockClear();
    handleMutationError(error(401));
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
