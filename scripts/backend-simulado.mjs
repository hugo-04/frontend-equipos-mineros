// Backend simulado SOLO para pruebas locales y para el escaneo ZAP del CI. No es el backend real:
// responde con la misma forma del contrato (login, tipos, equipos, mantenimientos paginados).
// Uso: PUERTO=8080 node scripts/backend-simulado.mjs
import { createServer } from "node:http";

const PUERTO = Number(process.env.PUERTO ?? 8080);
const USUARIO = process.env.SIM_USUARIO ?? "admin";
const CLAVE = process.env.SIM_CLAVE ?? "admin-simulado-123";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const tipos = [
  { id: 1, nombre: "Camión", intervaloHoras: 250 },
  { id: 2, nombre: "Excavadora", intervaloHoras: 500 },
  { id: 3, nombre: "Perforadora", intervaloHoras: 300 },
];
let secuencia = 3;
const equipos = [
  { id: 1, codigo: "CAM-001", tipoId: 1, horometro: 120.5, ultimo: 0 },
  { id: 2, codigo: "EXC-001", tipoId: 2, horometro: 520, ultimo: 0 },
  { id: 3, codigo: "PER-001", tipoId: 3, horometro: 90, ultimo: 0 },
];
const mantenimientos = [];

const vista = (e) => {
  const tipo = tipos.find((t) => t.id === e.tipoId);
  const requiere = e.horometro - e.ultimo >= tipo.intervaloHoras;
  return {
    id: e.id,
    codigo: e.codigo,
    tipo,
    horometro: e.horometro,
    horometroUltimoMant: e.ultimo,
    requiereMantenimiento: requiere,
    estado: requiere ? "REQUIERE_MANTENIMIENTO" : "OK",
    creadoEn: "2026-01-01T00:00:00Z",
  };
};
const pagina = (lista, q) => {
  const page = Math.max(0, Number(q.get("page") ?? 0));
  const size = Math.min(100, Math.max(1, Number(q.get("size") ?? 20)));
  const total = lista.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    page,
    size,
    totalElements: total,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
    content: lista.slice(page * size, (page + 1) * size),
  };
};
const error = (res, status, code, message) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      status,
      error: "",
      code,
      message,
      path: "",
      traceId: crypto.randomUUID(),
      details: [],
    }),
  );
};
const json = (res, status, cuerpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
};
const leerCuerpo = (req) =>
  new Promise((ok) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try {
        ok(JSON.parse(d || "{}"));
      } catch {
        ok(null);
      }
    });
  });

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const ruta = url.pathname.replace(/\/+$/, "");
  if (ruta === "/health") return json(res, 200, { status: "UP", version: "simulado" });
  if (ruta === "/auth/login" && req.method === "POST") {
    const c = await leerCuerpo(req);
    if (c?.username === USUARIO && c?.password === CLAVE) {
      const exp = Math.floor(Date.now() / 1000) + 1800;
      return json(res, 200, {
        accessToken: `${b64({ alg: "HS256" })}.${b64({ sub: USUARIO, rol: "ADMIN", exp })}.simulado1234567890`,
        tokenType: "Bearer",
        expiresIn: 1800,
      });
    }
    return error(res, 401, "CREDENCIALES_INVALIDAS", "Usuario o contraseña incorrectos");
  }
  if (!(req.headers.authorization ?? "").startsWith("Bearer "))
    return error(res, 401, "NO_AUTENTICADO", "Autenticación requerida");

  if (ruta === "/tipos") return json(res, 200, pagina(tipos, url.searchParams));
  if (ruta === "/equipos" && req.method === "GET")
    return json(res, 200, pagina(equipos.map(vista), url.searchParams));
  if (ruta === "/equipos" && req.method === "POST") {
    const c = await leerCuerpo(req);
    if (!c?.codigo || equipos.some((e) => e.codigo === c.codigo))
      return error(res, 409, "CODIGO_DUPLICADO", `El código ${c?.codigo} ya existe`);
    const e = {
      id: ++secuencia,
      codigo: c.codigo,
      tipoId: c.tipoId,
      horometro: c.horometro,
      ultimo: 0,
    };
    equipos.push(e);
    return json(res, 201, vista(e));
  }
  const m = /^\/equipos\/(\d+)(\/mantenimientos)?$/.exec(ruta);
  if (m) {
    const e = equipos.find((x) => x.id === Number(m[1]));
    if (!e) return error(res, 404, "EQUIPO_NO_ENCONTRADO", "Equipo no encontrado");
    if (m[2]) {
      if (req.method === "GET")
        return json(
          res,
          200,
          pagina(mantenimientos.filter((x) => x.equipoId === e.id).reverse(), url.searchParams),
        );
      const c = await leerCuerpo(req);
      const reg = {
        id: mantenimientos.length + 1,
        equipoId: e.id,
        fecha: new Date().toISOString(),
        horometroAlRegistrar: e.horometro,
        ...(c?.notas ? { notas: c.notas } : {}),
      };
      mantenimientos.push(reg);
      e.ultimo = e.horometro;
      return json(res, 201, reg);
    }
    if (req.method === "GET") return json(res, 200, vista(e));
    if (req.method === "PUT") {
      const c = await leerCuerpo(req);
      if (c.horometro < e.horometro)
        return error(res, 422, "HOROMETRO_INVALIDO", "El horómetro no puede disminuir");
      Object.assign(e, { codigo: c.codigo, tipoId: c.tipoId, horometro: c.horometro });
      return json(res, 200, vista(e));
    }
    if (req.method === "DELETE") {
      equipos.splice(equipos.indexOf(e), 1);
      res.writeHead(204);
      return res.end();
    }
  }
  return error(res, 404, "RUTA_NO_ENCONTRADA", "Ruta no encontrada");
}).listen(PUERTO, () =>
  console.log(`Backend simulado en http://localhost:${PUERTO} (usuario ${USUARIO})`),
);
