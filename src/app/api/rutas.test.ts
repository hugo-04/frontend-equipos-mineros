// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const llamarBackend = vi.fn();
vi.mock("@/shared/server/backend", () => ({
  llamarBackend: (...args: unknown[]) => llamarBackend(...args),
}));
vi.mock("@/shared/server/logger", () => ({ registrar: vi.fn() }));

import { proxy } from "@/proxy";
import { limitadorLogin } from "@/shared/server/rate-limit";
import { GET as sesionInvalida } from "./auth/sesion-invalida/route";
import { POST as login } from "./auth/login/route";
import { POST as logout } from "./auth/logout/route";
import { DELETE as proxyDelete, GET as proxyGet, POST as proxyPost } from "./proxy/[...path]/route";

const HOST = "https://app.test";

function b64(o: object): string {
  return btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function crearJwt(expDeltaSeg: number): string {
  return `${b64({ alg: "HS256" })}.${b64({ sub: "admin", rol: "ADMIN", exp: Math.floor(Date.now() / 1000) + expDeltaSeg })}.firmasecreta1234567890`;
}
const TOKEN = crearJwt(1800);

function peticion(
  ruta: string,
  init: {
    metodo?: string;
    cuerpo?: unknown;
    origin?: string | null;
    cookie?: string;
    ip?: string;
  } = {},
) {
  const headers = new Headers({ host: "app.test" });
  if (init.origin !== null) headers.set("origin", init.origin ?? HOST);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.ip) headers.set("x-forwarded-for", init.ip);
  if (init.cuerpo !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${HOST}${ruta}`, {
    method: init.metodo ?? "GET",
    headers,
    body:
      init.cuerpo === undefined
        ? undefined
        : typeof init.cuerpo === "string"
          ? init.cuerpo
          : JSON.stringify(init.cuerpo),
  });
}

const contexto = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const respuestaBackend = (
  status: number,
  cuerpo: unknown = {},
  extra: Record<string, string | null> = {},
) => ({
  status,
  cuerpo: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  contentType: "application/json",
  retryAfter: extra.retryAfter ?? null,
  traceId: extra.traceId ?? null,
});

beforeEach(() => {
  llamarBackend.mockReset();
  limitadorLogin.reiniciar("9.9.9.9");
  limitadorLogin.reiniciar("1.1.1.1");
});

describe("POST /api/auth/login", () => {
  it("guarda el token en una cookie httpOnly y NUNCA lo devuelve al navegador", async () => {
    llamarBackend.mockResolvedValue(
      respuestaBackend(200, { accessToken: TOKEN, tokenType: "Bearer", expiresIn: 1800 }),
    );
    const r = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "admin", password: "x" },
        ip: "9.9.9.9",
      }),
    );
    const cuerpo = await r.text();

    expect(r.status).toBe(200);
    expect(JSON.parse(cuerpo)).toEqual({ ok: true, usuario: { username: "admin", rol: "ADMIN" } });
    expect(cuerpo).not.toContain(TOKEN);
    expect(cuerpo).not.toContain("accessToken");
    expect(r.headers.get("cache-control")).toBe("no-store");

    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`sesion=${TOKEN}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Path=/");
    // La cookie nunca dura más que el token
    const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie)?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(1800);
  });

  it("credenciales malas: 401 sin cookie y con el mensaje genérico del backend", async () => {
    llamarBackend.mockResolvedValue(
      respuestaBackend(401, {
        status: 401,
        code: "CREDENCIALES_INVALIDAS",
        message: "Usuario o contraseña incorrectos",
      }),
    );
    const r = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "admin", password: "mala" },
        ip: "9.9.9.9",
      }),
    );
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie")).toBeNull();
    expect((await r.json()).code).toBe("CREDENCIALES_INVALIDAS");
  });

  it("bloquea por IP tras 10 fallos (429 con Retry-After) sin llamar más al backend", async () => {
    llamarBackend.mockResolvedValue(
      respuestaBackend(401, { status: 401, code: "CREDENCIALES_INVALIDAS", message: "x" }),
    );
    for (let i = 0; i < 10; i++) {
      await login(
        peticion("/api/auth/login", {
          metodo: "POST",
          cuerpo: { username: "a", password: "b" },
          ip: "9.9.9.9",
        }),
      );
    }
    llamarBackend.mockClear();
    const r = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "a", password: "b" },
        ip: "9.9.9.9",
      }),
    );
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(llamarBackend).not.toHaveBeenCalled();
  });

  it("propaga el 429 del backend con su Retry-After", async () => {
    llamarBackend.mockResolvedValue(
      respuestaBackend(
        429,
        { status: 429, code: "DEMASIADOS_INTENTOS", message: "x" },
        { retryAfter: "300" },
      ),
    );
    const r = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "a", password: "b" },
        ip: "1.1.1.1",
      }),
    );
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("300");
  });

  it("rechaza un Origin ajeno (CSRF) y un cuerpo inválido", async () => {
    const ajeno = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "a", password: "b" },
        origin: "https://evil.com",
      }),
    );
    expect(ajeno.status).toBe(403);
    const sinOrigin = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "a", password: "b" },
        origin: null,
      }),
    );
    expect(sinOrigin.status).toBe(403);
    const invalido = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "", password: "" },
        ip: "1.1.1.1",
      }),
    );
    expect(invalido.status).toBe(400);
    expect((await invalido.json()).details.length).toBeGreaterThan(0);
    const malformado = await login(
      peticion("/api/auth/login", { metodo: "POST", cuerpo: "{no es json", ip: "1.1.1.1" }),
    );
    expect(malformado.status).toBe(400);
    expect(llamarBackend).not.toHaveBeenCalled();
  });

  it("falla cerrado si el backend no responde o contesta algo fuera de contrato", async () => {
    llamarBackend.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const caido = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "a", password: "b" },
        ip: "1.1.1.1",
      }),
    );
    expect(caido.status).toBe(503);
    expect(caido.headers.get("set-cookie")).toBeNull();
    expect(await caido.text()).not.toContain("ECONNREFUSED");

    llamarBackend.mockResolvedValueOnce(respuestaBackend(200, { algo: "raro" }));
    const raro = await login(
      peticion("/api/auth/login", {
        metodo: "POST",
        cuerpo: { username: "a", password: "b" },
        ip: "1.1.1.1",
      }),
    );
    expect(raro.status).toBe(502);
    expect(raro.headers.get("set-cookie")).toBeNull();
  });

  it("rechaza cuerpos enormes con 413", async () => {
    const r = await login(
      peticion("/api/auth/login", { metodo: "POST", cuerpo: "x".repeat(20_000), ip: "1.1.1.1" }),
    );
    expect(r.status).toBe(413);
  });
});

describe("POST /api/auth/logout y sesión inválida", () => {
  it("logout borra la cookie", async () => {
    const r = await logout(
      peticion("/api/auth/logout", { metodo: "POST", cookie: `sesion=${TOKEN}` }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toMatch(/sesion=;/);
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });

  it("logout rechaza un Origin ajeno", async () => {
    const r = await logout(
      peticion("/api/auth/logout", { metodo: "POST", origin: "https://evil.com" }),
    );
    expect(r.status).toBe(403);
  });

  it("sesion-invalida borra la cookie y redirige solo a rutas internas", async () => {
    const r = sesionInvalida(peticion("/api/auth/sesion-invalida?from=//evil.com"));
    expect(r.status).toBe(303);
    const destino = new URL(r.headers.get("location") ?? "");
    expect(destino.origin).toBe(HOST);
    expect(destino.pathname).toBe("/login");
    expect(destino.searchParams.get("from")).toBe("/equipos");
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });
});

describe("/api/proxy/[...path]", () => {
  const conSesion = `sesion=${TOKEN}`;

  it("reenvía con el Bearer del servidor, sin cookies del navegador, y devuelve estado y cuerpo", async () => {
    llamarBackend.mockResolvedValue(respuestaBackend(200, { content: [] }, { traceId: "t-9" }));
    const r = await proxyGet(
      peticion("/api/proxy/equipos?page=1&size=20&otro=x", {
        cookie: `${conSesion}; analytics=abc`,
      }),
      contexto("equipos"),
    );

    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-trace-id")).toBe("t-9");
    const [ruta, init] = llamarBackend.mock.calls[0] as [
      string,
      { token: string; metodo: string; cuerpo?: string },
    ];
    expect(ruta).toBe("equipos?page=1&size=20"); // 'otro' se descarta
    expect(init.token).toBe(TOKEN);
    expect(JSON.stringify(init)).not.toContain("analytics");
    expect(await r.text()).not.toContain(TOKEN);
  });

  it("sin cookie o con la cookie vencida: 401 y no llama al backend", async () => {
    const sin = await proxyGet(peticion("/api/proxy/equipos"), contexto("equipos"));
    expect(sin.status).toBe(401);
    const vencida = await proxyGet(
      peticion("/api/proxy/equipos", { cookie: `sesion=${crearJwt(-60)}` }),
      contexto("equipos"),
    );
    expect(vencida.status).toBe(401);
    expect(vencida.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
    expect(llamarBackend).not.toHaveBeenCalled();
  });

  it("si el backend responde 401 se borra la cookie", async () => {
    llamarBackend.mockResolvedValue(
      respuestaBackend(401, { status: 401, code: "TOKEN_INVALIDO", message: "x" }),
    );
    const r = await proxyGet(
      peticion("/api/proxy/equipos", { cookie: conSesion }),
      contexto("equipos"),
    );
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie")).toMatch(/sesion=;/);
    expect((await r.json()).code).toBe("TOKEN_INVALIDO");
  });

  it("rechaza escrituras con Origin ajeno o ausente", async () => {
    const ajeno = await proxyPost(
      peticion("/api/proxy/equipos", {
        metodo: "POST",
        cuerpo: { codigo: "X" },
        origin: "https://evil.com",
        cookie: conSesion,
      }),
      contexto("equipos"),
    );
    expect(ajeno.status).toBe(403);
    const sin = await proxyDelete(
      peticion("/api/proxy/equipos/5", { metodo: "DELETE", origin: null, cookie: conSesion }),
      contexto("equipos", "5"),
    );
    expect(sin.status).toBe(403);
    expect(llamarBackend).not.toHaveBeenCalled();
  });

  it.each([
    [["equipos", "..", "auth", "login"]],
    [["auth", "login"]],
    [["http:", "evil.com"]],
    [["equipos", "5", "..", "6"]],
  ])("rechaza la ruta %j (404) sin llamar al backend", async (segmentos) => {
    const r = await proxyGet(
      peticion(`/api/proxy/${segmentos.join("/")}`, { cookie: conSesion }),
      contexto(...segmentos),
    );
    expect(r.status).toBe(404);
    expect(llamarBackend).not.toHaveBeenCalled();
  });

  it("falla cerrado ante backend caído o timeout, sin filtrar el error", async () => {
    llamarBackend.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.5:8080"));
    const caido = await proxyGet(
      peticion("/api/proxy/equipos", { cookie: conSesion }),
      contexto("equipos"),
    );
    expect(caido.status).toBe(503);
    expect(await caido.text()).not.toContain("10.0.0.5");

    const abort = Object.assign(new Error("timeout"), { name: "AbortError" });
    llamarBackend.mockRejectedValueOnce(abort);
    const lento = await proxyGet(
      peticion("/api/proxy/equipos", { cookie: conSesion }),
      contexto("equipos"),
    );
    expect(lento.status).toBe(504);
  });

  it("rechaza cuerpos de escritura enormes", async () => {
    const r = await proxyPost(
      peticion("/api/proxy/equipos", {
        metodo: "POST",
        cuerpo: "x".repeat(20_000),
        cookie: conSesion,
      }),
      contexto("equipos"),
    );
    expect(r.status).toBe(413);
  });

  it("DELETE devuelve 204 sin cuerpo", async () => {
    llamarBackend.mockResolvedValue({
      status: 204,
      cuerpo: "",
      contentType: null,
      retryAfter: null,
      traceId: null,
    });
    const r = await proxyDelete(
      peticion("/api/proxy/equipos/5", { metodo: "DELETE", cookie: conSesion }),
      contexto("equipos", "5"),
    );
    expect(r.status).toBe(204);
  });
});

describe("proxy.ts (rutas protegidas y CSP)", () => {
  const req = (ruta: string, cookie?: string) =>
    new NextRequest(`${HOST}${ruta}`, { headers: cookie ? { cookie } : {} });

  it("sin sesión redirige a /login con `from` seguro", () => {
    const r = proxy(req("/equipos/5?x=1"));
    const destino = new URL(r.headers.get("location") ?? "");
    expect(destino.pathname).toBe("/login");
    expect(destino.searchParams.get("from")).toBe("/equipos/5?x=1");
  });

  it("sin sesión, la API responde 401 JSON (no redirige)", () => {
    const r = proxy(req("/api/proxy/equipos"));
    expect(r.status).toBe(401);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("con sesión, /login redirige a /equipos", () => {
    const r = proxy(req("/login", `sesion=${TOKEN}`));
    expect(new URL(r.headers.get("location") ?? "").pathname).toBe("/equipos");
  });

  it("deja pasar /login, /api/health y el login sin sesión, y añade la CSP con nonce", () => {
    for (const ruta of ["/login", "/api/health", "/api/auth/login"]) {
      const r = proxy(req(ruta));
      expect(r.headers.get("location")).toBeNull();
      expect(r.headers.get("content-security-policy")).toMatch(/script-src 'self' 'nonce-[^']+'/);
    }
  });

  it("una cookie vencida cuenta como sin sesión", () => {
    const r = proxy(req("/equipos", `sesion=${crearJwt(-30)}`));
    expect(new URL(r.headers.get("location") ?? "").pathname).toBe("/login");
  });

  it("cada petición recibe un nonce distinto", () => {
    const n = () =>
      /nonce-([^']+)'/.exec(proxy(req("/login")).headers.get("content-security-policy") ?? "")?.[1];
    expect(n()).not.toBe(n());
  });
});
