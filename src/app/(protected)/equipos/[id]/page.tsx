import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { idSchema } from "@/shared/schemas/pagina";
import { DetalleEquipo } from "./detalle-equipo";

export const metadata: Metadata = { title: "Detalle del equipo" };

export default async function EquipoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // El id de la URL se valida antes de usarse: debe ser un entero positivo
  const validado = idSchema.safeParse(/^\d{1,15}$/.test(id) ? Number(id) : NaN);
  if (!validado.success) notFound();
  return <DetalleEquipo id={validado.data} />;
}
