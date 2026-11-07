import type { Metadata } from "next";
import { EquiposView } from "@/features/equipos";

export const metadata: Metadata = { title: "Equipos" };

export default function EquiposPage() {
  return <EquiposView />;
}
