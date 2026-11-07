import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";

/**
 * Estado de mantenimiento. Nunca se comunica solo con color: lleva ícono y texto.
 * OK = verde; requiere mantenimiento = ámbar con un pulso discreto (apagado con prefers-reduced-motion).
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
