import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";
import { crearEquipoSchema, editarEquipoSchema, equipoSchema } from "./equipo.schema";

const valido = { codigo: "CAM-001", tipoId: "1", horometro: "120.5" };

function mensajes(entrada: unknown, esquema: ZodType = crearEquipoSchema): Record<string, string> {
  const r = esquema.safeParse(entrada);
  if (r.success) return {};
  const salida: Record<string, string> = {};
  // Como react-hook-form: se queda con el PRIMER mensaje de cada campo
  for (const i of r.error.issues) salida[String(i.path[0])] ??= i.message;
  return salida;
}

// Las reglas del formulario para crear un equipo, las mismas del contrato del backend
describe("crearEquipoSchema", () => {
  it("acepta un equipo válido y convierte tipoId y horómetro a número", () => {
    const r = crearEquipoSchema.parse(valido);
    expect(r).toEqual({ codigo: "CAM-001", tipoId: 1, horometro: 120.5 });
  });

  it("recorta espacios del código y acepta coma decimal", () => {
    const r = crearEquipoSchema.parse({ ...valido, codigo: "  CAM-001  ", horometro: "10,5" });
    expect(r.codigo).toBe("CAM-001");
    expect(r.horometro).toBe(10.5);
  });

  it.each([
    ["con espacios", "CAM 001"],
    ["con símbolos", "CAM_001!"],
    ["muy corto", "AB"],
    ["muy largo", "A".repeat(31)],
    ["vacío", ""],
  ])("rechaza un código %s", (_, codigo) => {
    expect(mensajes({ ...valido, codigo }).codigo).toBeDefined();
  });

  it("acepta los límites del código (3 y 30 caracteres)", () => {
    expect(crearEquipoSchema.safeParse({ ...valido, codigo: "ABC" }).success).toBe(true);
    expect(crearEquipoSchema.safeParse({ ...valido, codigo: "A".repeat(30) }).success).toBe(true);
  });

  it.each([["0"], ["-1"], ["abc"], [""], ["1.5"]])("rechaza tipoId %j", (tipoId) => {
    expect(mensajes({ ...valido, tipoId }).tipoId).toBeDefined();
  });

  it("rechaza un horómetro negativo con un mensaje claro", () => {
    expect(mensajes({ ...valido, horometro: "-5" }).horometro).toBe(
      "El horómetro no puede ser negativo",
    );
  });

  it("rechaza un horómetro con dos decimales", () => {
    expect(mensajes({ ...valido, horometro: "10.55" }).horometro).toBe("Máximo un decimal");
  });

  it.each([["abc"], [""], ["1e3"], ["12abc"]])(
    "rechaza un horómetro no numérico %j",
    (horometro) => {
      expect(mensajes({ ...valido, horometro }).horometro).toBeDefined();
    },
  );

  it("acepta 0 y 999999.9 y rechaza por encima del máximo", () => {
    expect(crearEquipoSchema.safeParse({ ...valido, horometro: "0" }).success).toBe(true);
    expect(crearEquipoSchema.safeParse({ ...valido, horometro: "999999.9" }).success).toBe(true);
    expect(mensajes({ ...valido, horometro: "1000000" }).horometro).toContain("999999.9");
  });
});

// Al editar solo se cambian código y horómetro: el tipo es inmutable y no forma parte del esquema
describe("editarEquipoSchema", () => {
  const edicion = { codigo: "CAM-001", horometro: "150" };

  it("acepta código y horómetro y no pide el tipo", () => {
    expect(editarEquipoSchema(100).parse(edicion)).toEqual({ codigo: "CAM-001", horometro: 150 });
  });

  it("descarta un tipoId que se cuele: nunca llega al cuerpo de la actualización", () => {
    const r = editarEquipoSchema(100).parse({ ...edicion, tipoId: "2" });
    expect(r).toEqual({ codigo: "CAM-001", horometro: 150 });
    expect(r).not.toHaveProperty("tipoId");
  });

  it("rechaza un horómetro menor al actual con el valor mínimo en el mensaje", () => {
    expect(mensajes({ ...edicion, horometro: "99.9" }, editarEquipoSchema(100)).horometro).toBe(
      "El horómetro no puede ser menor al actual (100)",
    );
  });

  it("acepta mantener o subir el horómetro", () => {
    const esquema = editarEquipoSchema(100);
    expect(esquema.safeParse({ ...edicion, horometro: "100" }).success).toBe(true);
    expect(esquema.safeParse({ ...edicion, horometro: "150.5" }).success).toBe(true);
  });

  it("mantiene las reglas del código y del formato del horómetro", () => {
    const esquema = editarEquipoSchema(0);
    expect(mensajes({ ...edicion, codigo: "AB" }, esquema).codigo).toBeDefined();
    expect(mensajes({ ...edicion, codigo: "CAM 1" }, esquema).codigo).toBeDefined();
    expect(mensajes({ ...edicion, horometro: "10.55" }, esquema).horometro).toBe(
      "Máximo un decimal",
    );
    expect(mensajes({ ...edicion, horometro: "-1" }, esquema).horometro).toBe(
      "El horómetro no puede ser negativo",
    );
  });

  it("sin horómetro actual no pone mínimo", () => {
    expect(editarEquipoSchema().safeParse({ ...edicion, horometro: "0" }).success).toBe(true);
  });
});

// Lo que llega del API se valida antes de usarse
describe("equipoSchema (respuesta del API)", () => {
  const respuesta = {
    id: 1,
    codigo: "CAM-001",
    tipo: { id: 1, nombre: "Camión", intervaloHoras: 250 },
    horometro: 10,
    horometroUltimoMant: 0,
    horasDesdeUltimoMant: 10,
    horasRestantes: 240,
    requiereMantenimiento: false,
    estado: "OK",
    creadoEn: "2026-01-01T00:00:00Z",
  };

  it("acepta una respuesta conforme al contrato", () => {
    expect(equipoSchema.safeParse(respuesta).success).toBe(true);
  });

  it("rechaza una respuesta fuera de contrato", () => {
    expect(equipoSchema.safeParse({ ...respuesta, horometro: "10" }).success).toBe(false);
    expect(equipoSchema.safeParse({ ...respuesta, tipo: null }).success).toBe(false);
  });

  it("rechaza una respuesta a la que le faltan las horas calculadas", () => {
    const sinRestantes: Record<string, unknown> = { ...respuesta };
    delete sinRestantes.horasRestantes;
    const sinDesde: Record<string, unknown> = { ...respuesta };
    delete sinDesde.horasDesdeUltimoMant;
    expect(equipoSchema.safeParse(sinRestantes).success).toBe(false);
    expect(equipoSchema.safeParse(sinDesde).success).toBe(false);
  });
});
