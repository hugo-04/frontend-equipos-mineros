import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/auth/schemas/login.schema";
import { mantenimientoFormSchema, mantenimientoSchema, NOTAS_MAXIMO } from "./mantenimiento.schema";

describe("mantenimientoFormSchema", () => {
  it("las notas son opcionales", () => {
    expect(mantenimientoFormSchema.safeParse({}).success).toBe(true);
    expect(mantenimientoFormSchema.safeParse({ notas: "Cambio de aceite" }).success).toBe(true);
  });

  it("acepta exactamente 500 caracteres y rechaza 501", () => {
    expect(mantenimientoFormSchema.safeParse({ notas: "a".repeat(NOTAS_MAXIMO) }).success).toBe(
      true,
    );
    const r = mantenimientoFormSchema.safeParse({ notas: "a".repeat(NOTAS_MAXIMO + 1) });
    expect(r.success).toBe(false);
  });
});

describe("mantenimientoSchema", () => {
  const base = { id: 1, equipoId: 2, fecha: "2026-01-01T00:00:00Z", horometroAlRegistrar: 250 };

  it("normaliza notas ausentes o null a undefined", () => {
    expect(mantenimientoSchema.parse(base).notas).toBeUndefined();
    expect(mantenimientoSchema.parse({ ...base, notas: null }).notas).toBeUndefined();
    expect(mantenimientoSchema.parse({ ...base, notas: "ok" }).notas).toBe("ok");
  });
});

describe("loginSchema", () => {
  it("exige usuario y contraseña", () => {
    const r = loginSchema.safeParse({ username: "  ", password: "" });
    expect(r.success).toBe(false);
  });

  it("acepta credenciales completas", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "x" }).success).toBe(true);
  });
});
