import { describe, expect, it } from "vitest";
import { leerClaims, tokenVigente } from "./jwt-claims";

function jwt(payload: object): string {
  const b64 = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.firma`;
}

// Solo se lee el payload, sin verificar la firma: sirve para el vencimiento y para mostrar usuario y rol
describe("leerClaims", () => {
  it("lee sub, rol y exp", () => {
    expect(leerClaims(jwt({ sub: "admin", rol: "ADMIN", exp: 123 }))).toEqual({
      sub: "admin",
      rol: "ADMIN",
      exp: 123,
    });
  });

  it.each(["", "a.b", "a.b.c.d", "a.%%%.c", "a.bm90LWpzb24.c"])(
    "devuelve null para %j",
    (token) => {
      expect(leerClaims(token)).toBeNull();
    },
  );

  it("ignora claims con tipos incorrectos", () => {
    expect(leerClaims(jwt({ sub: 1, rol: [], exp: "x" }))).toEqual({
      sub: undefined,
      rol: undefined,
      exp: undefined,
    });
  });
});

// Un token vencido, ilegible o sin exp se trata como si no hubiera sesión
describe("tokenVigente", () => {
  const ahora = 1_700_000_000_000;

  it("es vigente si exp está en el futuro", () => {
    expect(tokenVigente(jwt({ exp: ahora / 1000 + 600 }), ahora)).toBe(true);
  });

  it("no es vigente si venció, está por vencer (margen de 5 s), no tiene exp o no existe", () => {
    expect(tokenVigente(jwt({ exp: ahora / 1000 - 1 }), ahora)).toBe(false);
    expect(tokenVigente(jwt({ exp: ahora / 1000 + 2 }), ahora)).toBe(false);
    expect(tokenVigente(jwt({ sub: "x" }), ahora)).toBe(false);
    expect(tokenVigente(undefined, ahora)).toBe(false);
    expect(tokenVigente("basura", ahora)).toBe(false);
  });
});
