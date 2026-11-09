"use client";

import { AnimatePresence, motion } from "motion/react";
import { History, Info, PackageOpen, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTipos } from "@/features/tipos";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorPanel } from "@/shared/components/error-panel";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatearHorometro, textoHorasRestantes } from "@/shared/lib/formatters";
import { useEliminarEquipo, useEquipos } from "../hooks/use-equipos";
import type { Equipo } from "../types";
import { EquipoFormDialog } from "./equipo-form-dialog";
import { EstadoBadge } from "./estado-badge";
import { EquiposSkeleton } from "./skeletons";

const POR_PAGINA = 10;
type FiltroEstado = "todos" | "requiere" | "ok";

const entrada = (indice: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, delay: Math.min(indice * 0.03, 0.3), ease: "easeOut" as const },
  },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
});

const CLAVE_AYUDA = "equipos.ayuda-mantenimiento-oculta";
const EVENTO_AYUDA = "equipos:ayuda-oculta";

function leerAyudaOculta(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_AYUDA) === "1";
  } catch {
    return false;
  }
}

function suscribirseAlAlmacenamiento(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_AYUDA, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_AYUDA, avisar);
  };
}

/**
 * Explica en tres líneas cómo se controla el mantenimiento, para quien entra por primera vez y no sabe qué hace cada botón.
 * Se puede descartar y el navegador lo recuerda; si no puede guardarlo (modo privado, por ejemplo), simplemente vuelve a salir.
 */
function AyudaMantenimiento() {
  // El navegador es la fuente de verdad de "ya la descartó"; en el servidor se muestra y el cliente corrige al hidratar
  const guardadaComoOculta = useSyncExternalStore(
    suscribirseAlAlmacenamiento,
    leerAyudaOculta,
    () => false,
  );
  // Si el navegador no deja guardar (modo privado), el aviso se oculta igual mientras dure la visita
  const [descartada, setDescartada] = useState(false);

  if (guardadaComoOculta || descartada) return null;

  const ocultar = () => {
    setDescartada(true);
    try {
      window.localStorage.setItem(CLAVE_AYUDA, "1");
      window.dispatchEvent(new Event(EVENTO_AYUDA));
    } catch {
      // no pasa nada: se mostrará de nuevo la próxima vez
    }
  };

  return (
    <section
      aria-label="Cómo se controla el mantenimiento"
      className="bg-muted/50 flex items-start gap-3 rounded-lg border p-4"
    >
      <Info className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-1 text-sm">
        <p className="font-semibold">¿Cómo se controla el mantenimiento?</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
          <li>
            Cada equipo necesita mantenimiento cada cierto número de horas de su horómetro (depende
            de su tipo).
          </li>
          <li>
            Cuando llega ese momento aparece <strong>Requiere mantenimiento</strong>. Después de
            hacerlo, pulsa <strong>Registrar</strong> en su fila: el conteo de horas vuelve a
            empezar.
          </li>
          <li>
            Pulsa <strong>Historial</strong> para ver todos los mantenimientos anteriores de un
            equipo.
          </li>
        </ul>
      </div>
      <Button variant="ghost" size="sm" onClick={ocultar}>
        <X aria-hidden="true" />
        Entendido
      </Button>
    </section>
  );
}

/**
 * La pantalla de equipos: tabla (o tarjetas en móvil) con búsqueda y filtros que se aplican en el cliente, más crear, editar y eliminar.
 * `accionesFila` deja que la ruta ponga junto a cada equipo lo que viene de otra feature (por ejemplo, registrar un mantenimiento),
 * porque las features no se importan entre sí.
 */
export function EquiposView({ accionesFila }: { accionesFila?: (equipo: Equipo) => ReactNode }) {
  const equipos = useEquipos();
  const tipos = useTipos();
  const eliminar = useEliminarEquipo();

  const [busqueda, setBusqueda] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>("todos");
  const [pagina, setPagina] = useState(1);
  const [formAbierto, setFormAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<Equipo | null>(null);
  const [porEliminar, setPorEliminar] = useState<Equipo | null>(null);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (equipos.data ?? []).filter(
      (e) =>
        (texto === "" || e.codigo.toLowerCase().includes(texto)) &&
        (tipoFiltro === "todos" || String(e.tipo.id) === tipoFiltro) &&
        (estadoFiltro === "todos" || (estadoFiltro === "requiere") === e.requiereMantenimiento),
    );
  }, [equipos.data, busqueda, tipoFiltro, estadoFiltro]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const abrirCrear = () => {
    setEnEdicion(null);
    setFormAbierto(true);
  };
  const abrirEditar = (equipo: Equipo) => {
    setEnEdicion(equipo);
    setFormAbierto(true);
  };
  const cambiarFiltro =
    <T,>(setter: (v: T) => void) =>
    (valor: T) => {
      setter(valor);
      setPagina(1);
    };

  if (equipos.isPending) return <EquiposSkeleton />;
  if (equipos.isError)
    return <ErrorPanel error={equipos.error} alReintentar={() => void equipos.refetch()} />;

  const sinDatos = equipos.data.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Equipos"
        descripcion={`${equipos.data.length} equipos registrados${equipos.isFetching ? " · actualizando…" : ""}`}
        acciones={
          <Button onClick={abrirCrear}>
            <Plus aria-hidden="true" />
            Nuevo equipo
          </Button>
        }
      />

      {sinDatos ? (
        <EmptyState
          icono={<PackageOpen className="size-10" aria-hidden="true" />}
          titulo="Aún no hay equipos"
          descripcion="Registra el primero para empezar a controlar su mantenimiento."
          accion={<Button onClick={abrirCrear}>Nuevo equipo</Button>}
        />
      ) : (
        <>
          <AyudaMantenimiento />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4"
                aria-hidden="true"
              />
              <Input
                aria-label="Buscar por código"
                placeholder="Buscar por código"
                className="pl-9"
                value={busqueda}
                onChange={(e) => cambiarFiltro(setBusqueda)(e.target.value)}
              />
            </div>
            <Select value={tipoFiltro} onValueChange={cambiarFiltro(setTipoFiltro)}>
              <SelectTrigger aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {(tipos.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={estadoFiltro}
              onValueChange={(v) => cambiarFiltro(setEstadoFiltro)(v as FiltroEstado)}
            >
              <SelectTrigger aria-label="Filtrar por estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="requiere">Requiere mantenimiento</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtrados.length === 0 ? (
            <EmptyState
              icono={<Search className="size-10" aria-hidden="true" />}
              titulo="Sin resultados"
              descripcion="Ningún equipo coincide con los filtros."
              accion={
                <Button
                  variant="outline"
                  onClick={() => {
                    setBusqueda("");
                    setTipoFiltro("todos");
                    setEstadoFiltro("todos");
                  }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <>
              {/* La tabla se ve desde pantallas medianas; en móvil se usan las tarjetas de más abajo */}
              <div className="hidden rounded-lg border md:block">
                <Table>
                  <caption className="sr-only">Lista de equipos mineros</caption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Horómetro</TableHead>
                      <TableHead className="text-right">Horas restantes</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Mantenimiento</TableHead>
                      <TableHead className="text-right">Editar o eliminar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibles.map((e, i) => (
                        <motion.tr
                          key={e.id}
                          {...entrada(i)}
                          className="hover:bg-muted/50 border-b transition-colors"
                        >
                          <TableCell className="font-medium">
                            <Link
                              href={`/equipos/${e.id}`}
                              title={`Ver el detalle de ${e.codigo}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {e.codigo}
                            </Link>
                          </TableCell>
                          <TableCell>{e.tipo.nombre}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatearHorometro(e.horometro)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatearHorometro(e.horasRestantes)}
                          </TableCell>
                          <TableCell>
                            <EstadoBadge requiereMantenimiento={e.requiereMantenimiento} />
                          </TableCell>
                          <TableCell>
                            <AccionesMantenimiento equipo={e}>
                              {accionesFila?.(e)}
                            </AccionesMantenimiento>
                          </TableCell>
                          <TableCell>
                            <Acciones
                              equipo={e}
                              alEditar={abrirEditar}
                              alEliminar={setPorEliminar}
                            />
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>

              {/* Tarjetas para pantallas chicas */}
              <ul className="space-y-3 md:hidden">
                <AnimatePresence initial={false}>
                  {visibles.map((e, i) => (
                    <motion.li
                      key={e.id}
                      {...entrada(i)}
                      className="bg-card space-y-3 rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            <Link
                              href={`/equipos/${e.id}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {e.codigo}
                            </Link>
                          </p>
                          <p className="text-muted-foreground text-sm">{e.tipo.nombre}</p>
                        </div>
                        <EstadoBadge requiereMantenimiento={e.requiereMantenimiento} />
                      </div>
                      <p className="text-sm tabular-nums">
                        Horómetro: {formatearHorometro(e.horometro)}
                      </p>
                      <p className="text-muted-foreground text-sm tabular-nums">
                        {textoHorasRestantes(e.horasRestantes, e.requiereMantenimiento)}
                      </p>
                      <AccionesMantenimiento equipo={e}>{accionesFila?.(e)}</AccionesMantenimiento>
                      <Acciones equipo={e} alEditar={abrirEditar} alEliminar={setPorEliminar} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              {totalPaginas > 1 && (
                <nav aria-label="Paginación" className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    Página {paginaActual} de {totalPaginas} · {filtrados.length} resultados
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={paginaActual === 1}
                      onClick={() => setPagina(paginaActual - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={paginaActual === totalPaginas}
                      onClick={() => setPagina(paginaActual + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </nav>
              )}
            </>
          )}
        </>
      )}

      <EquipoFormDialog abierto={formAbierto} alCambiar={setFormAbierto} equipo={enEdicion} />

      <ConfirmDialog
        abierto={porEliminar !== null}
        alCambiar={(abierto) => !abierto && setPorEliminar(null)}
        titulo="¿Eliminar equipo?"
        descripcion={
          <>
            Se eliminará el equipo <strong>{porEliminar?.codigo}</strong> junto con todo su
            historial de mantenimientos. Esta acción no se puede deshacer.
          </>
        }
        cargando={eliminar.isPending}
        alConfirmar={() => {
          if (porEliminar) {
            eliminar.mutate(
              { id: porEliminar.id, codigo: porEliminar.codigo },
              { onSettled: () => setPorEliminar(null) },
            );
          }
        }}
      />
    </div>
  );
}

/** Lo que se hace con el mantenimiento de un equipo, con texto en cada botón para que se entienda sin explicación. */
function AccionesMantenimiento({ equipo, children }: { equipo: Equipo; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <Button
        asChild
        variant="outline"
        size="sm"
        title={`Ver los mantenimientos anteriores de ${equipo.codigo}`}
      >
        <Link
          href={`/equipos/${equipo.id}#historial`}
          aria-label={`Ver el historial de mantenimientos de ${equipo.codigo}`}
        >
          <History aria-hidden="true" />
          Historial
        </Link>
      </Button>
    </div>
  );
}

function Acciones({
  equipo,
  alEditar,
  alEliminar,
}: {
  equipo: Equipo;
  alEditar: (e: Equipo) => void;
  alEliminar: (e: Equipo) => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Editar ${equipo.codigo}`}
        title={`Editar ${equipo.codigo}`}
        onClick={() => alEditar(equipo)}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Eliminar ${equipo.codigo}`}
        title={`Eliminar ${equipo.codigo}`}
        onClick={() => alEliminar(equipo)}
      >
        <Trash2 className="text-destructive" aria-hidden="true" />
      </Button>
    </div>
  );
}
