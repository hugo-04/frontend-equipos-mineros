"use client";

import { EquipoDetalle, useEquipo } from "@/features/equipos";
import { HistorialMantenimientos, RegistrarMantenimientoDialog } from "@/features/mantenimientos";

/** Compone equipos + mantenimientos (las features no se importan entre sí; las une la ruta). */
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
