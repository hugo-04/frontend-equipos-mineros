import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
const historial = vi.fn();
vi.mock("../hooks/use-mantenimientos", () => ({
  useMantenimientos: (...a: unknown[]) => historial(...a),
  useRegistrarMantenimiento: () => ({ isPending: false, mutate: vi.fn() }),
}));

import { HistorialMantenimientos } from "./historial-mantenimientos";
import { RegistrarMantenimientoDialog } from "./registrar-mantenimiento-dialog";

function conCliente(hijo: ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{hijo}</QueryClientProvider>);
}

describe("RegistrarMantenimientoDialog", () => {
  it("en el detalle dice 'Registrar mantenimiento' y es la acción principal", () => {
    conCliente(<RegistrarMantenimientoDialog equipoId={1} codigo="CAM-001" />);
    const boton = screen.getByRole("button", { name: "Registrar mantenimiento de CAM-001" });
    expect(boton).toHaveTextContent("Registrar mantenimiento");
    expect(boton).toHaveClass("bg-primary");
  });

  it("en la lista es compacto: dice 'Registrar' y solo se resalta si el equipo lo requiere", () => {
    conCliente(
      <>
        <RegistrarMantenimientoDialog equipoId={1} codigo="CAM-001" compacto destacado />
        <RegistrarMantenimientoDialog equipoId={2} codigo="EXC-002" compacto destacado={false} />
      </>,
    );
    const requiere = screen.getByRole("button", { name: "Registrar mantenimiento de CAM-001" });
    const alDia = screen.getByRole("button", { name: "Registrar mantenimiento de EXC-002" });
    expect(requiere).toHaveTextContent(/^Registrar$/);
    expect(requiere).toHaveClass("bg-primary");
    expect(alDia).not.toHaveClass("bg-primary");
  });

  it("al abrirlo explica con palabras simples qué hace", async () => {
    const user = userEvent.setup();
    conCliente(<RegistrarMantenimientoDialog equipoId={1} codigo="CAM-001" compacto />);
    await user.click(screen.getByRole("button", { name: "Registrar mantenimiento de CAM-001" }));
    expect(await screen.findByText(/Úsalo cuando ya se hizo el mantenimiento/)).toBeInTheDocument();
    expect(
      screen.getByText(/el conteo de horas hasta el próximo mantenimiento/),
    ).toBeInTheDocument();
  });
});

describe("HistorialMantenimientos", () => {
  it("tiene el ancla #historial y explica qué es", () => {
    historial.mockReturnValue({
      isPending: false,
      isError: false,
      data: { content: [], totalPages: 0, page: 0, first: true, last: true },
    });
    const { container } = conCliente(<HistorialMantenimientos equipoId={1} />);
    expect(container.querySelector("#historial")).not.toBeNull();
    expect(
      screen.getByText(/Cada vez que se registra un mantenimiento queda guardado aquí/),
    ).toBeInTheDocument();
  });

  it("si no hay mantenimientos, dice qué hacer para que aparezca el primero", () => {
    historial.mockReturnValue({
      isPending: false,
      isError: false,
      data: { content: [], totalPages: 0, page: 0, first: true, last: true },
    });
    conCliente(<HistorialMantenimientos equipoId={1} />);
    expect(screen.getByText("Todavía no hay mantenimientos registrados")).toBeInTheDocument();
    expect(screen.getByText(/pulsa «Registrar mantenimiento»/)).toBeInTheDocument();
  });
});
