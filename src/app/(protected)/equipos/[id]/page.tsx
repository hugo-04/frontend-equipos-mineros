import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { idSchema } from "@/shared/schemas/pagina";
import { DetalleEquipo } from "./detalle-equipo";

export const metadata: Metadata = { title: "Detalle del equipo" };

/** Página de detalle: valida el id de la URL y deja el resto en DetalleEquipo. */
export default async function EquipoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // El id de la URL se valida antes de usarlo: tiene que ser un entero positivo; si no, 404
  const validado = idSchema.safeParse(/^\d{1,15}$/.test(id) ? Number(id) : NaN);
  if (!validado.success) notFound();
  return <DetalleEquipo id={validado.data} />;
}
