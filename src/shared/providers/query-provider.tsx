"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError, ErrorDeRed } from "@/shared/api/api-error";
import { registrarManejador401 } from "@/shared/api/http";

/** Solo se reintenta ante red caída o 5xx (y máximo 2 veces); un 4xx nunca se reintenta. */
export function debeReintentar(intento: number, error: unknown): boolean {
  if (intento >= 2) return false;
  if (error instanceof ErrorDeRed) return true;
  return error instanceof ApiError && error.status >= 500 && error.code !== "RESPUESTA_INVALIDA";
}

function crearCliente(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: debeReintentar,
        refetchOnWindowFocus: true, // moderado: solo refresca si los datos ya están "stale" (30 s)
      },
      mutations: { retry: false },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [cliente] = useState(crearCliente);

  useEffect(() => {
    let avisado = false;
    registrarManejador401(() => {
      if (avisado) return; // varias consultas pueden fallar a la vez: un solo aviso y una sola redirección
      avisado = true;
      cliente.clear();
      toast.warning("Tu sesión expiró");
      const destino = `/api/auth/sesion-invalida?from=${encodeURIComponent(window.location.pathname)}`;
      // Navegación completa a una ruta de API (borra la cookie y redirige): no es una página de Next
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.setTimeout(() => window.location.assign(destino), 600);
    });
    return () => registrarManejador401(null);
  }, [cliente]);

  return (
    <QueryClientProvider client={cliente}>
      {/* Respeta prefers-reduced-motion en todas las animaciones de Motion */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  );
}
