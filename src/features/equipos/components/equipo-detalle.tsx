"use client";

import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorPanel } from "@/shared/components/error-panel";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatearFecha, formatearHorometro, textoHorasRestantes } from "@/shared/lib/formatters";
import { classifyError } from "@/shared/api/api-error";
import { EmptyState } from "@/shared/components/empty-state";
import { Button } from "@/shared/components/ui/button";
import { useEquipo } from "../hooks/use-equipos";
import { EstadoBadge } from "./estado-badge";
import { DetalleSkeleton } from "./skeletons";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{etiqueta}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

/** Los datos del equipo y su estado. Las acciones y el historial los arma la página que lo usa, así esta feature no depende de mantenimientos. */
export function EquipoDetalle({
  id,
  acciones,
  children,
}: {
  id: number;
  acciones?: (equipoRequiere: boolean) => ReactNode;
  children?: ReactNode;
}) {
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      <Link
        href="/equipos"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a equipos
      </Link>
      <PageHeader
        titulo={e.codigo}
        descripcion={`${e.tipo.nombre} · mantenimiento cada ${e.tipo.intervaloHoras} h`}
        acciones={acciones?.(e.requiereMantenimiento)}
      />
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Estado</CardTitle>
          <EstadoBadge requiereMantenimiento={e.requiereMantenimiento} />
        </CardHeader>
        <CardContent className="space-y-4">
          <p
            className={
              e.requiereMantenimiento ? "text-warning-soft-foreground font-medium" : "font-medium"
            }
          >
            {textoHorasRestantes(e.horasRestantes, e.requiereMantenimiento)}
          </p>
          <p className="text-muted-foreground text-sm">
            {e.requiereMantenimiento
              ? "Cuando se haga el mantenimiento, pulsa «Registrar mantenimiento» para que el conteo de horas vuelva a empezar. "
              : "Cuando llegue la hora y se haga el mantenimiento, regístralo con el botón «Registrar mantenimiento». "}
            <a
              href="#historial"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Ver el historial de mantenimientos
            </a>
          </p>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Dato etiqueta="Horómetro actual" valor={formatearHorometro(e.horometro)} />
            <Dato
              etiqueta="Último mantenimiento a las"
              valor={formatearHorometro(e.horometroUltimoMant)}
            />
            <Dato
              etiqueta="Horas desde el último mantenimiento"
              valor={formatearHorometro(e.horasDesdeUltimoMant)}
            />
            <Dato etiqueta="Registrado" valor={formatearFecha(e.creadoEn)} />
          </dl>
        </CardContent>
      </Card>
      {children}
    </motion.div>
  );
}
