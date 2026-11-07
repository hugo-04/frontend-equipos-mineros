import { headers } from "next/headers";
import { rutaInternaSegura } from "@/shared/lib/ruta-segura";
import { exigirSesion } from "@/shared/server/sesion-servidor";
import { AppHeader } from "./_components/app-header";

// Siempre dinámico: la sesión se valida en cada petición, nunca desde caché
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const ruta = rutaInternaSegura((await headers()).get("x-ruta"));
  await exigirSesion(ruta);
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
