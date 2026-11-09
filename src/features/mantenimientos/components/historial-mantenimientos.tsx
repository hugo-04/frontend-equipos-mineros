"use client";

import { AnimatePresence, motion } from "motion/react";
import { History } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorPanel } from "@/shared/components/error-panel";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatearFecha, formatearHorometro } from "@/shared/lib/formatters";
import { useMantenimientos } from "../hooks/use-mantenimientos";

/**
 * El historial de mantenimientos de un equipo, paginado por el backend. Tiene el ancla `#historial` para poder
 * llegar directo desde la lista de equipos.
 */
export function HistorialMantenimientos({ equipoId }: { equipoId: number }) {
  const [pagina, setPagina] = useState(0);
  const historial = useMantenimientos(equipoId, pagina);

  return (
    <Card id="historial" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Historial de mantenimientos</CardTitle>
        <CardDescription>
          Cada vez que se registra un mantenimiento queda guardado aquí, con su fecha y el horómetro
          que tenía el equipo en ese momento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {historial.isPending ? (
          <div className="space-y-2" role="status" aria-label="Cargando historial">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : historial.isError ? (
          <ErrorPanel error={historial.error} alReintentar={() => void historial.refetch()} />
        ) : historial.data.content.length === 0 ? (
          <EmptyState
            icono={<History className="size-8" aria-hidden="true" />}
            titulo="Todavía no hay mantenimientos registrados"
            descripcion="Cuando se haga el mantenimiento de este equipo, pulsa «Registrar mantenimiento» (arriba): quedará guardado aquí."
          />
        ) : (
          <div className="space-y-4">
            <Table>
              <caption className="sr-only">Historial de mantenimientos del equipo</caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Horómetro</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {historial.data.content.map((m, i) => (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.2, delay: Math.min(i * 0.03, 0.25) },
                      }}
                      exit={{ opacity: 0 }}
                      className="border-b"
                    >
                      <TableCell className="whitespace-nowrap">{formatearFecha(m.fecha)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatearHorometro(m.horometroAlRegistrar)}
                      </TableCell>
                      {/* Las notas las escribe el usuario: se muestran siempre como texto, nunca como HTML */}
                      <TableCell className="text-muted-foreground max-w-xs break-words">
                        {m.notas ?? "—"}
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
            {historial.data.totalPages > 1 && (
              <nav
                aria-label="Paginación del historial"
                className="flex items-center justify-between"
              >
                <p className="text-muted-foreground text-sm">
                  Página {historial.data.page + 1} de {historial.data.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historial.data.first}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historial.data.last}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </nav>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
