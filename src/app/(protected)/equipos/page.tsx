import type { Metadata } from "next";
import { EquiposView } from "@/features/equipos";

export const metadata: Metadata = { title: "Equipos" };

/** La página de equipos; toda la lógica está en la feature. */
export default function EquiposPage() {
  return <EquiposView />;
}
