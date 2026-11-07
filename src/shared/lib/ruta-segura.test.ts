import { describe, expect, it } from "vitest";
import { rutaInternaSegura } from "./ruta-segura";

describe("rutaInternaSegura (anti open redirect)", () => {
  it.each([
    "//evil.com",
    "//evil.com/equipos",
    "https://evil.com",
    "http://evil.com/equipos",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "equipos",
    "",
    "/\tevil",
    "/%0d%0aSet-Cookie:x=1",
    "/login",
    "/api/auth/logout",
    "/" + "a".repeat(300),
  ])("rechaza %j y vuelve a /equipos", (valor) => {
    expect(rutaInternaSegura(valor)).toBe("/equipos");
  });

  it("rechaza null, undefined y valores que no son texto", () => {
    expect(rutaInternaSegura(null)).toBe("/equipos");
    expect(rutaInternaSegura(undefined)).toBe("/equipos");
    expect(rutaInternaSegura(42 as unknown as string)).toBe("/equipos");
  });

  it("acepta rutas internas, con query", () => {
    expect(rutaInternaSegura("/equipos")).toBe("/equipos");
    expect(rutaInternaSegura("/equipos/12")).toBe("/equipos/12");
    expect(rutaInternaSegura("/equipos?x=1")).toBe("/equipos?x=1");
  });

  it("usa el valor por defecto indicado", () => {
    expect(rutaInternaSegura("//x", "/inicio")).toBe("/inicio");
  });
});
