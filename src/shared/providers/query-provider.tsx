"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError, ErrorDeRed } from "@/shared/api/api-error";
import { registrarManejador401 } from "@/shared/api/http";

/** Se reintenta solo si se cayó la red o el servidor falló (5xx), máximo 2 veces. Un 4xx nunca: repetirlo no lo arregla. */
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

/** Arma el QueryClient y registra qué hacer cuando cualquier consulta recibe un 401. */
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
      // Navegación completa a una ruta de la API (borra la cookie y redirige al login), por eso no se usa el router de Next
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.setTimeout(() => window.location.assign(destino), 600);
    });
    return () => registrarManejador401(null);
  }, [cliente]);

  return (
    <QueryClientProvider client={cliente}>
      {/* Si el usuario pidió menos movimiento en su sistema, Motion apaga las animaciones */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  );
}
