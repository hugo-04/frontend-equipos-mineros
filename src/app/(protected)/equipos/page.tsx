import type { Metadata } from "next";
import { EquiposConMantenimiento } from "./equipos-con-mantenimiento";

export const metadata: Metadata = { title: "Equipos" };

/** La página de equipos; la lógica está en las features y esta ruta las junta. */
export default function EquiposPage() {
  return <EquiposConMantenimiento />;
}
