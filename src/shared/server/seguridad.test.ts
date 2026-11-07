import { describe, expect, it } from "vitest";
import config from "../../../next.config";
import { origenPermitido } from "./origin";
import { evaluarRuta, sanearQuery } from "./proxy-policy";
import { ipDelCliente, LimitadorLogin } from "./rate-limit";
import { CABECERAS_ESTATICAS, construirCsp } from "./security-headers";

const vacio = new URLSearchParams();

describe("lista blanca del proxy (A01: SSRF y path traversal)", () => {
  it.each([
    ["GET", ["tipos"]],
    ["GET", ["equipos"]],
    ["POST", ["equipos"]],
    ["GET", ["equipos", "5"]],
    ["PUT", ["equipos", "5"]],
    ["DELETE", ["equipos", "5"]],
    ["GET", ["equipos", "5", "mantenimientos"]],
    ["POST", ["equipos", "5", "mantenimientos"]],
  ])("permite %s /%s", (metodo, segmentos) => {
    expect(evaluarRuta(metodo, segmentos, vacio).permitido).toBe(true);
  });

  it.each([
    ["GET", [".."]],
    ["GET", ["equipos", ".."]],
    ["GET", ["equipos", "..", "auth", "login"]],
    ["GET", ["equipos", "5", "..", "6"]],
    ["GET", ["equipos", ".", "5"]],
    ["GET", ["", "equipos"]],
    ["GET", ["equipos", "5/mantenimientos"]],
    ["GET", ["equipos", "%2e%2e"]],
    ["GET", ["equipos", "5%2f..%2fx"]],
    ["GET", ["equipos", "5\\..\\x"]],
    ["GET", ["http:", "evil.com"]],
    ["GET", ["https://evil.com"]],
    ["GET", ["@evil.com"]],
    ["GET", ["equipos", "5?x=1"]],
    ["GET", ["equipos", "5#frag"]],
    ["GET", ["auth", "login"]],
    ["GET", ["health"]],
    ["GET", ["swagger-ui", "index.html"]],
    ["GET", ["v3", "api-docs"]],
    ["GET", ["equipos", "0"]],
    ["GET", ["equipos", "-1"]],
    ["GET", ["equipos", "abc"]],
    ["GET", ["equipos", "5", "otra"]],
    ["GET", []],
    ["GET", ["a", "b", "c", "d", "e"]],
    ["PATCH", ["equipos", "5"]],
    ["DELETE", ["equipos"]],
    ["PUT", ["tipos"]],
    ["POST", ["tipos"]],
  ])("rechaza %s /%j", (metodo, segmentos) => {
    expect(evaluarRuta(metodo, segmentos, vacio).permitido).toBe(false);
  });

  it("solo deja pasar page y size numéricos", () => {
    expect(sanearQuery(new URLSearchParams("page=2&size=50&sort=x&host=evil"))).toBe(
      "?page=2&size=50",
    );
    expect(sanearQuery(new URLSearchParams("page=abc&size=-1"))).toBe("");
    const r = evaluarRuta("GET", ["equipos"], new URLSearchParams("page=1&x=http://evil"));
    expect(r).toEqual({ permitido: true, ruta: "equipos", query: "?page=1" });
  });
});

describe("verificación de Origin (A07: CSRF)", () => {
  const url = "https://app.example.com/api/proxy/equipos";
  const con = (h: Record<string, string>) => new Headers(h);

  it("acepta el mismo host", () => {
    expect(
      origenPermitido(con({ origin: "https://app.example.com", host: "app.example.com" }), url),
    ).toBe(true);
  });

  it("acepta el host reenviado por el proxy del hosting", () => {
    expect(
      origenPermitido(
        con({
          origin: "https://app.example.com",
          "x-forwarded-host": "app.example.com",
          host: "interno:3000",
        }),
        "http://interno:3000/x",
      ),
    ).toBe(true);
  });

  it("rechaza un Origin ajeno, ausente o ilegible", () => {
    expect(origenPermitido(con({ origin: "https://evil.com", host: "app.example.com" }), url)).toBe(
      false,
    );
    expect(origenPermitido(con({ host: "app.example.com" }), url)).toBe(false);
    expect(origenPermitido(con({ origin: "null", host: "app.example.com" }), url)).toBe(false);
    expect(
      origenPermitido(
        con({ origin: "https://app.example.com.evil.com", host: "app.example.com" }),
        url,
      ),
    ).toBe(false);
  });
});

describe("límite de intentos de login (A06)", () => {
  it("bloquea tras el máximo y se libera al pasar la ventana", () => {
    const l = new LimitadorLogin(3, 1000);
    for (let i = 0; i < 3; i++) l.registrarFallo("ip", 0);
    expect(l.bloqueadoPor("ip", 500)).toBeGreaterThan(0);
    expect(l.bloqueadoPor("otra", 500)).toBe(0);
    expect(l.bloqueadoPor("ip", 1500)).toBe(0);
  });

  it("un login correcto reinicia el contador", () => {
    const l = new LimitadorLogin(2, 1000);
    l.registrarFallo("ip", 0);
    l.registrarFallo("ip", 0);
    l.reiniciar("ip");
    expect(l.bloqueadoPor("ip", 10)).toBe(0);
  });

  it("no crece sin límite", () => {
    const l = new LimitadorLogin(3, 1000, 5);
    for (let i = 0; i < 50; i++) l.registrarFallo(`ip${i}`, i);
    expect(l.bloqueadoPor("ip49", 60)).toBe(0);
  });

  it("toma la IP del primer valor de x-forwarded-for", () => {
    expect(ipDelCliente(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(ipDelCliente(new Headers())).toBe("desconocida");
    expect(ipDelCliente(new Headers({ "x-forwarded-for": "x".repeat(100) }))).toBe("desconocida");
  });
});

describe("cabeceras de seguridad (A02)", () => {
  it("la CSP de producción no permite scripts inline ni eval", () => {
    const csp = construirCsp("abc123", true);
    const scripts = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("upgrade-insecure-requests solo cuando se sirve por HTTPS", () => {
    expect(construirCsp("n", true, false)).not.toContain("upgrade-insecure-requests");
    expect(construirCsp("n", true, true)).toContain("upgrade-insecure-requests");
  });

  it("en desarrollo permite eval (solo para React Refresh)", () => {
    expect(construirCsp("n", false)).toContain("'unsafe-eval'");
  });

  it("las cabeceras estáticas están completas", () => {
    expect(CABECERAS_ESTATICAS).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(CABECERAS_ESTATICAS["Strict-Transport-Security"]).toContain("max-age=");
    expect(CABECERAS_ESTATICAS["Permissions-Policy"]).toContain("camera=()");
  });

  it("next.config publica las cabeceras y apaga poweredByHeader y los source maps", async () => {
    expect(config.poweredByHeader).toBe(false);
    expect(config.productionBrowserSourceMaps).toBe(false);
    const reglas = await config.headers?.();
    const claves = (reglas?.[0]?.headers ?? []).map((h) => h.key);
    expect(claves).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });
});
