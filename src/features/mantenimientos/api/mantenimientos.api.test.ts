import { beforeEach, describe, expect, it, vi } from "vitest";

const peticion = vi.fn();
vi.mock("@/shared/api/http", () => ({ peticion: (...a: unknown[]) => peticion(...a) }));

import { registrarMantenimiento } from "./mantenimientos.api";

beforeEach(() => peticion.mockReset().mockResolvedValue({}));

const cuerpoEnviado = () => peticion.mock.calls[0]?.[1]?.cuerpo;

// Las notas son opcionales: si no hay texto, no se mandan
describe("registrarMantenimiento", () => {
  it.each([[undefined], [""], ["   "], ["\t\n"]])(
    "con notas %j manda un cuerpo vacío",
    async (notas) => {
      await registrarMantenimiento(3, notas);
      expect(cuerpoEnviado()).toEqual({});
    },
  );

  it("manda las notas sin espacios en los bordes", async () => {
    await registrarMantenimiento(3, "  Cambio de aceite  ");
    expect(cuerpoEnviado()).toEqual({ notas: "Cambio de aceite" });
  });

  it("acepta 500 caracteres y rechaza 501 sin llamar al backend", () => {
    void registrarMantenimiento(3, "a".repeat(500));
    expect(peticion).toHaveBeenCalledTimes(1);
    expect(() => registrarMantenimiento(3, "a".repeat(501))).toThrow();
    expect(peticion).toHaveBeenCalledTimes(1);
  });
});
