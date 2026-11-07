import Link from "next/link";
import { Button } from "@/shared/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">No encontramos esa página</h1>
      <p className="text-muted-foreground">Puede que el enlace esté mal escrito o que el contenido ya no exista.</p>
      <Button asChild>
        <Link href="/equipos">Ir a equipos</Link>
      </Button>
    </main>
  );
}
