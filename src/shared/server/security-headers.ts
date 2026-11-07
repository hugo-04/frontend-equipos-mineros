/** Cabeceras de seguridad. La CSP lleva un nonce distinto en cada petición, así los scripts no necesitan unsafe-inline ni unsafe-eval. */
export function construirCsp(
  nonce: string,
  produccion: boolean,
  https: boolean = produccion,
): string {
  const directivas = [
    "default-src 'self'",
    // En desarrollo Next necesita eval (por React Refresh); en producción nunca
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${produccion ? "" : " 'unsafe-eval'"}`,
    // Sonner, Motion y Next meten estilos en línea, por eso style-src conserva unsafe-inline. Es el único compromiso de la CSP (está en el README)
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Solo si la página se sirve por HTTPS: en http://localhost forzaría https y rompería el modo local
    ...(https ? ["upgrade-insecure-requests"] : []),
  ];
  return directivas.join("; ");
}

export const CABECERAS_ESTATICAS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
};
