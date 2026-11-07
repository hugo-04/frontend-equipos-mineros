/** Cabeceras de seguridad (A02). La CSP lleva nonce por petición: sin unsafe-inline ni unsafe-eval en scripts. */
export function construirCsp(nonce: string, produccion: boolean): string {
  const directivas = [
    "default-src 'self'",
    // En desarrollo Next necesita eval (React Refresh); en producción nunca
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${produccion ? "" : " 'unsafe-eval'"}`,
    // Sonner, Motion y Next inyectan estilos en línea: es el único compromiso de la CSP (documentado en el README)
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(produccion ? ["upgrade-insecure-requests"] : []),
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
