import type { NextConfig } from "next";
import { CABECERAS_ESTATICAS } from "./src/shared/server/security-headers";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // A02: no anunciar la tecnología
  productionBrowserSourceMaps: false, // A02: no publicar el código fuente
  async headers() {
    // La CSP con nonce se genera por petición en src/proxy.ts; aquí van las cabeceras estáticas
    return [
      {
        source: "/:path*",
        headers: Object.entries(CABECERAS_ESTATICAS).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default config;
