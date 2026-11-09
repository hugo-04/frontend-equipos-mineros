import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Equipo } from "../types";

const equipos: Equipo[] = [
  {
    id: 1,
    codigo: "CAM-001",
    tipo: { id: 1, nombre: "Camión", intervaloHoras: 250 },
    horometro: 300,
    horometroUltimoMant: 0,
    horasDesdeUltimoMant: 300,
    horasRestantes: 0,
    requiereMantenimiento: true,
    estado: "REQUIERE_MANTENIMIENTO",
    creadoEn: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    codigo: "EXC-002",
    tipo: { id: 2, nombre: "Excavadora", intervaloHoras: 500 },
    horometro: 100,
    horometroUltimoMant: 0,
    horasDesdeUltimoMant: 100,
    horasRestantes: 400,
    requiereMantenimiento: false,
    estado: "OK",
    creadoEn: "2026-01-01T00:00:00Z",
  },
];

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("../hooks/use-equipos", () => ({
  useEquipos: () => ({
    data: equipos,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useEliminarEquipo: () => ({ isPending: false, mutate: vi.fn() }),
  useCrearEquipo: () => ({ isPending: false, mutate: vi.fn() }),
  useActualizarEquipo: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/features/tipos", () => ({
  useTipos: () => ({ isPending: false, data: [{ id: 1, nombre: "Camión", intervaloHoras: 250 }] }),
  tipoEquipoSchema: { parse: (x: unknown) => x },
}));

import { EquiposView } from "./equipos-view";

function montar(accionesFila?: (e: Equipo) => React.ReactNode) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <EquiposView accionesFila={accionesFila} />
    </QueryClientProvider>,
  );
}

beforeEach(() => window.localStorage.clear());

// Quien entra por primera vez tiene que entender qué hace cada cosa sin que nadie se lo explique
describe("EquiposView: el mantenimiento se entiende sin explicación", () => {
  it("cada equipo tiene un botón 'Historial' con texto que lleva al historial de ese equipo", () => {
    montar();
    // La tabla y las tarjetas de móvil se renderizan a la vez en jsdom: se toma la primera
    const [enlace] = screen.getAllByRole("link", {
      name: "Ver el historial de mantenimientos de CAM-001",
    });
    expect(enlace).toHaveAttribute("href", "/equipos/1#historial");
    expect(enlace).toHaveTextContent("Historial");
  });

  it("el código del equipo es un enlace a su detalle (ya no hace falta el ojito)", () => {
    montar();
    const [codigo] = screen.getAllByRole("link", { name: "CAM-001" });
    expect(codigo).toHaveAttribute("href", "/equipos/1");
    expect(screen.queryByRole("link", { name: /Ver detalle de/ })).not.toBeInTheDocument();
  });

  it("pone junto a cada equipo lo que le pasa la ruta (el botón de registrar mantenimiento)", () => {
    montar((e) => <button type="button">{`Registrar ${e.codigo}`}</button>);
    expect(screen.getAllByRole("button", { name: "Registrar CAM-001" })).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Registrar EXC-002" })).not.toHaveLength(0);
  });

  it("los botones de editar y eliminar tienen una pista al pasar el mouse", () => {
    montar();
    const [editar] = screen.getAllByRole("button", { name: "Editar CAM-001" });
    const [eliminar] = screen.getAllByRole("button", { name: "Eliminar CAM-001" });
    expect(editar).toHaveAttribute("title", "Editar CAM-001");
    expect(eliminar).toHaveAttribute("title", "Eliminar CAM-001");
  });

  it("la tabla tiene una columna 'Mantenimiento' con el nombre de lo que se puede hacer", () => {
    montar();
    const tabla = screen.getByRole("table");
    expect(within(tabla).getByRole("columnheader", { name: "Mantenimiento" })).toBeInTheDocument();
  });
});

describe("EquiposView: aviso de cómo funciona el mantenimiento", () => {
  it("se muestra la primera vez, con los tres pasos en palabras simples", () => {
    montar();
    const aviso = screen.getByRole("region", { name: "Cómo se controla el mantenimiento" });
    expect(within(aviso).getByText(/Requiere mantenimiento/)).toBeInTheDocument();
    expect(within(aviso).getByText("Registrar")).toBeInTheDocument();
    expect(within(aviso).getByText("Historial")).toBeInTheDocument();
  });

  it("'Entendido' lo oculta y el navegador lo recuerda", async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    await user.click(screen.getByRole("button", { name: "Entendido" }));
    expect(
      screen.queryByRole("region", { name: "Cómo se controla el mantenimiento" }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem("equipos.ayuda-mantenimiento-oculta")).toBe("1");

    unmount();
    montar();
    expect(
      screen.queryByRole("region", { name: "Cómo se controla el mantenimiento" }),
    ).not.toBeInTheDocument();
  });

  it("si el navegador no puede guardar, lo oculta igual durante la visita", async () => {
    const user = userEvent.setup();
    const guardar = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("sin almacenamiento");
    });
    montar();
    await user.click(screen.getByRole("button", { name: "Entendido" }));
    expect(
      screen.queryByRole("region", { name: "Cómo se controla el mantenimiento" }),
    ).not.toBeInTheDocument();
    guardar.mockRestore();
  });
});
