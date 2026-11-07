"use client";

import { LogOut, Moon, Pickaxe, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLogout } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";

const sinSuscripcion = () => () => {};

export function AppHeader() {
  const logout = useLogout();
  const { resolvedTheme, setTheme } = useTheme();
  // Evita el desajuste de hidratación: el tema real solo se conoce en el cliente
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const oscuro = montado && resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/equipos" className="flex items-center gap-2 font-bold">
          <Pickaxe className="size-5 text-primary" aria-hidden="true" />
          Equipos mineros
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            onClick={() => setTheme(oscuro ? "light" : "dark")}
          >
            {oscuro ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </Button>
          <Button variant="outline" size="sm" cargando={logout.isPending} onClick={() => logout.mutate()}>
            <LogOut aria-hidden="true" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </header>
  );
}
