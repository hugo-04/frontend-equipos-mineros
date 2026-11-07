import type { NextConfig } from "next";
import { CABECERAS_ESTATICAS } from "./src/shared/server/security-headers";

const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone", // genera un server.js autosuficiente para la imagen de Docker
  poweredByHeader: false, // no avisar que esto corre con Next.js
  productionBrowserSourceMaps: false, // no publicar el código fuente en producción
  async headers() {
    // La CSP con nonce se arma en cada petición en src/proxy.ts; acá van solo las cabeceras que no cambian
    return [
      {
        source: "/:path*",
        headers: Object.entries(CABECERAS_ESTATICAS).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default config;
