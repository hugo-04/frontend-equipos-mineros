"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { handleMutationError, type OpcionesManejo } from "@/shared/api/error-handler";
import { cerrarSesion, iniciarSesion } from "../api/auth.api";

/** Inicia sesión y, si sale bien, lleva a la ruta de destino. */
export function useLogin(destino: string, opciones: () => OpcionesManejo = () => ({})) {
  const router = useRouter();
  return useMutation({
    mutationFn: iniciarSesion,
    // replace y refresh: así el servidor vuelve a leer la cookie nueva y las rutas protegidas ya la ven
    onSuccess: () => {
      router.replace(destino);
      router.refresh();
    },
    onError: (error) => handleMutationError(error, opciones()),
  });
}

/** Cierra la sesión y deja el navegador limpio: sin caché y de vuelta en el login. */
export function useLogout() {
  const cliente = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: cerrarSesion,
    // Haya salido bien o mal en el servidor, se limpia el caché local y se vuelve al login
    onSettled: () => {
      cliente.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}
