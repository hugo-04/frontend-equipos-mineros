"use client";

import { EquiposView } from "@/features/equipos";
import { RegistrarMantenimientoDialog } from "@/features/mantenimientos";

/**
 * Junta equipos y mantenimientos en la lista: junto a cada equipo, el botón para registrar un mantenimiento. Las features no se
 * importan entre sí, así que las une esta ruta. El botón sale resaltado solo cuando el equipo ya requiere mantenimiento.
 */
export function EquiposConMantenimiento() {
  return (
    <EquiposView
      accionesFila={(equipo) => (
        <RegistrarMantenimientoDialog
          equipoId={equipo.id}
          codigo={equipo.codigo}
          compacto
          destacado={equipo.requiereMantenimiento}
        />
      )}
    />
  );
}
