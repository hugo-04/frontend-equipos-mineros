"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { handleMutationError, type OpcionesManejo } from "@/shared/api/error-handler";
import { cerrarSesion, iniciarSesion } from "../api/auth.api";

export function useLogin(destino: string, opciones: () => OpcionesManejo = () => ({})) {
  const router = useRouter();
  return useMutation({
    mutationFn: iniciarSesion,
    // Navegación completa: el servidor vuelve a evaluar la cookie nueva
    onSuccess: () => {
      router.replace(destino);
      router.refresh();
    },
    onError: (error) => handleMutationError(error, opciones()),
  });
}

export function useLogout() {
  const cliente = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: cerrarSesion,
    // Pase lo que pase en el servidor, el caché local se limpia y se vuelve al login
    onSettled: () => {
      cliente.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}
