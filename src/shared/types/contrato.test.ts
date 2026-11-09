import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/auth/schemas/login.schema";
import { crearEquipoSchema, editarEquipoSchema } from "@/features/equipos/schemas/equipo.schema";
import { mantenimientoFormSchema } from "@/features/mantenimientos/schemas/mantenimiento.schema";

/**
 * Los tipos del contrato se comprueban al compilar (ver `Coinciden` en shared/types), pero los límites (largos, rangos y patrones)
 * no viajan en los tipos. Esta prueba los lee del propio contrato y exige que los formularios acepten y rechacen lo mismo que él.
 * Si el contrato cambia un límite y el formulario no, falla acá y dice cuál.
 */
interface CampoContrato {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  "x-field-extra-annotation"?: string;
}
interface EsquemaContrato {
  properties: Record<string, CampoContrato>;
  required?: string[];
}

const contrato = parse(readFileSync(resolve(process.cwd(), "openapi/openapi.yaml"), "utf8")) as {
  components: { schemas: Record<string, EsquemaContrato> };
};
const esquema = (nombre: string): EsquemaContrato => {
  const e = contrato.components.schemas[nombre];
  if (!e) throw new Error(`El contrato no tiene el esquema ${nombre}`);
  return e;
};
const campo = (nombre: string, propiedad: string): CampoContrato => {
  const c = esquema(nombre).properties[propiedad];
  if (!c) throw new Error(`El esquema ${nombre} del contrato no tiene el campo ${propiedad}`);
  return c;
};

describe.each([
  [
    "EquipoRequest (crear)",
    "EquipoRequest",
    (v: Record<string, string>) => crearEquipoSchema.safeParse({ tipoId: "1", ...v }),
  ],
  [
    "EquipoUpdateRequest (editar)",
    "EquipoUpdateRequest",
    (v: Record<string, string>) => editarEquipoSchema().safeParse(v),
  ],
])("%s: los límites del formulario son los del contrato", (_titulo, nombre, validar) => {
  const codigo = campo(nombre, "codigo");
  const horometro = campo(nombre, "horometro");

  it("código: largo mínimo y máximo y patrón", () => {
    const patron = new RegExp(codigo.pattern ?? ".*");
    const min = codigo.minLength ?? 0;
    const max = codigo.maxLength ?? Number.MAX_SAFE_INTEGER;
    const casos = [
      "A".repeat(min),
      "A".repeat(Math.max(min - 1, 0)),
      "A".repeat(max),
      "A".repeat(max + 1),
      "CAM-001",
      "CAM 001",
      "CAM_001",
      "ÁBC-1",
      "",
    ];
    for (const caso of casos) {
      const quiereElContrato = caso.length >= min && caso.length <= max && patron.test(caso);
      const resultado = validar({ codigo: caso, horometro: "10" }).success;
      expect(
        resultado,
        `código "${caso}": el contrato ${quiereElContrato ? "lo acepta" : "lo rechaza"}`,
      ).toBe(quiereElContrato);
    }
  });

  it("horómetro: mínimo y máximo", () => {
    const minimo = horometro.minimum ?? 0;
    const maximo = horometro.maximum ?? 0;
    const casos: [string, boolean][] = [
      [String(minimo), true],
      [String(minimo - 1), false],
      [String(maximo), true],
      [String(maximo + 1), false],
    ];
    for (const [valor, acepta] of casos) {
      expect(
        validar({ codigo: "CAM-001", horometro: valor }).success,
        `horómetro ${valor}: el contrato ${acepta ? "lo acepta" : "lo rechaza"}`,
      ).toBe(acepta);
    }
  });

  it("horómetro: un decimal como máximo, como declara @Digits del contrato", () => {
    expect(horometro["x-field-extra-annotation"]).toContain("fraction = 1");
    expect(validar({ codigo: "CAM-001", horometro: "10.5" }).success).toBe(true);
    expect(validar({ codigo: "CAM-001", horometro: "10.55" }).success).toBe(false);
  });
});

describe("EquipoRequest: tipoId", () => {
  it("el mínimo es el del contrato", () => {
    const minimo = campo("EquipoRequest", "tipoId").minimum ?? 1;
    const probar = (tipoId: string) =>
      crearEquipoSchema.safeParse({ codigo: "CAM-001", tipoId, horometro: "10" }).success;
    expect(probar(String(minimo))).toBe(true);
    expect(probar(String(minimo - 1))).toBe(false);
  });
});

describe("Los formularios mandan los mismos campos que pide el contrato", () => {
  it("crear equipo: los campos del EquipoRequest", () => {
    const salida = crearEquipoSchema.parse({ codigo: "CAM-001", tipoId: "1", horometro: "10" });
    expect(Object.keys(salida).sort()).toEqual(
      Object.keys(esquema("EquipoRequest").properties).sort(),
    );
  });

  it("editar equipo: los campos del EquipoUpdateRequest, sin tipoId", () => {
    const salida = editarEquipoSchema().parse({ codigo: "CAM-001", horometro: "10", tipoId: "2" });
    const delContrato = Object.keys(esquema("EquipoUpdateRequest").properties).sort();
    expect(Object.keys(salida).sort()).toEqual(delContrato);
    expect(delContrato).not.toContain("tipoId");
  });
});

describe("Mantenimiento y login: los límites son los del contrato", () => {
  it("notas del mantenimiento: largo máximo", () => {
    const max = campo("MantenimientoRequest", "notas").maxLength ?? 0;
    expect(mantenimientoFormSchema.safeParse({ notas: "a".repeat(max) }).success).toBe(true);
    expect(mantenimientoFormSchema.safeParse({ notas: "a".repeat(max + 1) }).success).toBe(false);
  });

  it.each(["username", "password"])("login: %s con su largo máximo", (nombre) => {
    const max = campo("LoginRequest", nombre).maxLength ?? 0;
    const otro = nombre === "username" ? { password: "x" } : { username: "x" };
    expect(loginSchema.safeParse({ ...otro, [nombre]: "a".repeat(max) }).success).toBe(true);
    expect(loginSchema.safeParse({ ...otro, [nombre]: "a".repeat(max + 1) }).success).toBe(false);
  });
});
