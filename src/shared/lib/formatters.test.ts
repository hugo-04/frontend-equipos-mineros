import { describe, expect, it } from "vitest";
import { formatearFecha, formatearHorometro } from "./formatters";

describe("formatearFecha", () => {
  it("muestra la hora de Perú (UTC-5)", () => {
    // 23:30 UTC son las 6:30 p. m. en Lima
    expect(formatearFecha("2026-11-07T23:30:00Z")).toMatch(/6:30\s?p\.?\s?m\./i);
  });

  it("cambia de día cuando en Lima todavía es el día anterior", () => {
    // 02:00 UTC del día 8 son las 9:00 p. m. del día 7 en Lima
    const texto = formatearFecha("2026-11-08T02:00:00Z");
    expect(texto).toContain("7");
    expect(texto).toMatch(/9:00\s?p\.?\s?m\./i);
  });

  it("devuelve un guion si la fecha no es válida", () => {
    expect(formatearFecha("no-es-fecha")).toBe("—");
  });
});

describe("formatearHorometro", () => {
  it("usa un decimal y la unidad", () => {
    expect(formatearHorometro(4533)).toMatch(/4.533,0 h|4,533\.0 h/);
  });
});
