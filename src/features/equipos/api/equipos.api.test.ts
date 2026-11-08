import { beforeEach, describe, expect, it, vi } from "vitest";

const peticion = vi.fn();
vi.mock("@/shared/api/http", () => ({ peticion: (...a: unknown[]) => peticion(...a) }));

import { actualizarEquipo, crearEquipo } from "./equipos.api";

beforeEach(() => peticion.mockReset().mockResolvedValue({}));

describe("crearEquipo", () => {
  it("envía código, tipoId y horómetro validados", async () => {
    await crearEquipo({ codigo: " CAM-001 ", tipoId: 1, horometro: 100 });
    expect(peticion).toHaveBeenCalledWith(
      "/equipos",
      expect.objectContaining({
        metodo: "POST",
        cuerpo: { codigo: "CAM-001", tipoId: 1, horometro: 100 },
      }),
    );
  });
});

// El tipo no se cambia: la actualización nunca lleva tipoId
describe("actualizarEquipo", () => {
  it("hace PUT con solo código y horómetro", async () => {
    await actualizarEquipo(7, { codigo: "CAM-007", horometro: 260 });
    expect(peticion).toHaveBeenCalledWith(
      "/equipos/7",
      expect.objectContaining({ metodo: "PUT", cuerpo: { codigo: "CAM-007", horometro: 260 } }),
    );
  });

  it("no envía un tipoId aunque alguien lo cuele en el objeto", async () => {
    const conTipo = { codigo: "CAM-007", horometro: 260, tipoId: 2 };
    await actualizarEquipo(7, conTipo);
    const cuerpo = peticion.mock.calls[0]?.[1]?.cuerpo as Record<string, unknown>;
    expect(cuerpo).toEqual({ codigo: "CAM-007", horometro: 260 });
    expect(cuerpo).not.toHaveProperty("tipoId");
  });

  it("rechaza un cuerpo inválido antes de llamar al backend", () => {
    expect(() => actualizarEquipo(7, { codigo: "AB", horometro: 1 })).toThrow();
    expect(peticion).not.toHaveBeenCalled();
  });
});
