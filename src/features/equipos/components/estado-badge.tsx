import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";

/**
 * Muestra si al equipo le toca mantenimiento. No depende solo del color: lleva ícono y texto. En verde es OK;
 * en ámbar es "Requiere mantenimiento", con un pulso discreto que se apaga si el usuario pidió menos movimiento.
 */
export function EstadoBadge({ requiereMantenimiento }: { requiereMantenimiento: boolean }) {
  if (requiereMantenimiento) {
    return (
      <Badge variant="warning">
        <AlertTriangle className="punto-pulso size-3.5" aria-hidden="true" />
        Requiere mantenimiento
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
      OK
    </Badge>
  );
}
