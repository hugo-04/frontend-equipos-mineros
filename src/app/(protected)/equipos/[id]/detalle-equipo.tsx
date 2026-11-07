"use client";

import { EquipoDetalle, useEquipo } from "@/features/equipos";
import { HistorialMantenimientos, RegistrarMantenimientoDialog } from "@/features/mantenimientos";

/** Junta equipos y mantenimientos. Las features no se importan entre sí, así que las une esta ruta. */
export function DetalleEquipo({ id }: { id: number }) {
  const equipo = useEquipo(id);
  const codigo = equipo.data?.codigo ?? "";
  return (
    <EquipoDetalle
      id={id}
      acciones={() => <RegistrarMantenimientoDialog equipoId={id} codigo={codigo} />}
    >
      <HistorialMantenimientos equipoId={id} />
    </EquipoDetalle>
  );
}
