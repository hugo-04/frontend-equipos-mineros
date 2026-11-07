import type { Metadata } from "next";
import { Pickaxe } from "lucide-react";
import { LoginForm } from "@/features/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { rutaInternaSegura } from "@/shared/lib/ruta-segura";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; expirada?: string }>;
}) {
  const { from, expirada } = await searchParams;
  // A01: solo rutas internas; cualquier otra cosa vuelve a /equipos
  const destino = rutaInternaSegura(from);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Pickaxe className="size-6" aria-hidden="true" />
          </div>
          <CardTitle>Equipos mineros</CardTitle>
          <CardDescription>Ingresa con tu usuario para continuar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {expirada === "1" && (
            <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
              Tu sesión expiró. Vuelve a ingresar.
            </p>
          )}
          <LoginForm destino={destino} />
        </CardContent>
      </Card>
    </main>
  );
}
