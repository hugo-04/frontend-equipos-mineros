import { headers } from "next/headers";
import { rutaInternaSegura } from "@/shared/lib/ruta-segura";
import { exigirSesion } from "@/shared/server/sesion-servidor";
import { AppHeader } from "./_components/app-header";

// Siempre dinámico: la sesión se valida en cada petición y nunca se sirve desde caché
export const dynamic = "force-dynamic";

/** Todo lo que está acá dentro exige sesión: se valida contra el backend antes de pintar el encabezado y la página. */
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
