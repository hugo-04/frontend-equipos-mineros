"use client";

import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorPanel } from "@/shared/components/error-panel";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatearFecha, formatearHorometro } from "@/shared/lib/formatters";
import { classifyError } from "@/shared/api/api-error";
import { EmptyState } from "@/shared/components/empty-state";
import { Button } from "@/shared/components/ui/button";
import { useEquipo } from "../hooks/use-equipos";
import { EstadoBadge } from "./estado-badge";
import { DetalleSkeleton } from "./skeletons";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

/** Datos del equipo. Las acciones y el historial los compone la página (así equipos no depende de mantenimientos). */
export function EquipoDetalle({ id, acciones, children }: { id: number; acciones?: (equipoRequiere: boolean) => ReactNode; children?: ReactNode }) {
  const equipo = useEquipo(id);

  if (equipo.isPending) return <DetalleSkeleton />;
  if (equipo.isError) {
    if (classifyError(equipo.error) === "notFound") {
      return (
        <EmptyState
          titulo="Equipo no encontrado"
          descripcion="Puede que haya sido eliminado."
          accion={
            <Button asChild>
              <Link href="/equipos">Volver a equipos</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorPanel error={equipo.error} alReintentar={() => void equipo.refetch()} />;
  }

  const e = equipo.data;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="space-y-6">
      <Link href="/equipos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a equipos
      </Link>
      <PageHeader titulo={e.codigo} descripcion={`${e.tipo.nombre} · mantenimiento cada ${e.tipo.intervaloHoras} h`} acciones={acciones?.(e.requiereMantenimiento)} />
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Estado</CardTitle>
          <EstadoBadge requiereMantenimiento={e.requiereMantenimiento} />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Dato etiqueta="Horómetro actual" valor={formatearHorometro(e.horometro)} />
            <Dato etiqueta="Último mantenimiento a las" valor={formatearHorometro(e.horometroUltimoMant)} />
            <Dato etiqueta="Registrado" valor={formatearFecha(e.creadoEn)} />
          </dl>
        </CardContent>
      </Card>
      {children}
    </motion.div>
  );
}
