import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/api-error";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

const crearEquipo = vi.fn();
vi.mock("../api/equipos.api", () => ({
  crearEquipo: (...a: unknown[]) => crearEquipo(...a),
  actualizarEquipo: vi.fn(),
  eliminarEquipo: vi.fn(),
  listarEquipos: vi.fn(),
  obtenerEquipo: vi.fn(),
}));
vi.mock("@/features/tipos", () => ({
  useTipos: () => ({ isPending: false, data: [{ id: 1, nombre: "Camión", intervaloHoras: 250 }] }),
  tipoEquipoSchema: { parse: (x: unknown) => x },
}));

import { toast } from "sonner";
import { EquipoFormDialog } from "./equipo-form-dialog";
import { EstadoBadge } from "./estado-badge";

// Radix usa APIs que jsdom no trae
beforeEach(() => {
  crearEquipo.mockReset();
  vi.mocked(toast.warning).mockClear();
  vi.mocked(toast.error).mockClear();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
});

function conCliente(ui: React.ReactElement) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={cliente}>{ui}</QueryClientProvider>);
}

describe("EstadoBadge", () => {
  it("muestra 'Requiere mantenimiento' con texto (no solo color)", () => {
    render(<EstadoBadge requiereMantenimiento />);
    expect(screen.getByText("Requiere mantenimiento")).toBeInTheDocument();
  });

  it("muestra 'OK' cuando no requiere mantenimiento", () => {
    render(<EstadoBadge requiereMantenimiento={false} />);
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.queryByText("Requiere mantenimiento")).not.toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("nombra lo que se elimina y confirma o cancela", async () => {
    const alConfirmar = vi.fn();
    const alCambiar = vi.fn();
    render(
      <ConfirmDialog
        abierto
        alCambiar={alCambiar}
        titulo="¿Eliminar equipo?"
        descripcion={
          <>
            Se eliminará <strong>CAM-001</strong>
          </>
        }
        alConfirmar={alConfirmar}
      />,
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent("CAM-001");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(alCambiar).toHaveBeenCalledWith(false);
  });

  it("mientras elimina deshabilita los botones (sin doble envío)", () => {
    render(
      <ConfirmDialog
        abierto
        alCambiar={vi.fn()}
        titulo="t"
        descripcion="d"
        cargando
        alConfirmar={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Eliminando/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});

describe("EquipoFormDialog", () => {
  it("valida antes de enviar: campos vacíos muestran errores accesibles y no llaman al API", async () => {
    conCliente(<EquipoFormDialog abierto alCambiar={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Crear equipo" }));

    const codigo = await screen.findByLabelText("Código");
    expect(codigo).toHaveAttribute("aria-invalid", "true");
    expect(codigo.getAttribute("aria-describedby")).toBe("codigo-error");
    expect(document.getElementById("codigo-error")).toHaveTextContent("al menos 3 caracteres");
    expect(await screen.findByText("Selecciona un tipo", { selector: "p" })).toBeInTheDocument();
    expect(crearEquipo).not.toHaveBeenCalled();
  });

  it("rechaza un horómetro con dos decimales o negativo", async () => {
    conCliente(<EquipoFormDialog abierto alCambiar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Código"), "CAM-001");
    await userEvent.type(screen.getByLabelText("Horómetro (horas)"), "10.55");
    await userEvent.click(screen.getByRole("button", { name: "Crear equipo" }));
    expect(await screen.findByText("Máximo un decimal")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Horómetro (horas)"));
    await userEvent.type(screen.getByLabelText("Horómetro (horas)"), "-3");
    await userEvent.click(screen.getByRole("button", { name: "Crear equipo" }));
    expect(await screen.findByText("El horómetro no puede ser negativo")).toBeInTheDocument();
    expect(crearEquipo).not.toHaveBeenCalled();
  });

  it("un 409 del backend se marca en el campo código", async () => {
    crearEquipo.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "CODIGO_DUPLICADO",
        message: "El código CAM-001 ya existe",
      }),
    );
    conCliente(<EquipoFormDialog abierto alCambiar={vi.fn()} equipo={null} />);
    await userEvent.type(screen.getByLabelText("Código"), "CAM-001");
    await userEvent.type(screen.getByLabelText("Horómetro (horas)"), "10");
    // Radix Select: el valor se fija desde el teclado
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: /Camión/ }));
    await userEvent.click(screen.getByRole("button", { name: "Crear equipo" }));

    await waitFor(() =>
      expect(crearEquipo).toHaveBeenCalledWith({ codigo: "CAM-001", tipoId: 1, horometro: 10 }),
    );
    expect(
      await screen.findByText("El código CAM-001 ya existe", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Código")).toHaveAttribute("aria-invalid", "true");
  });

  it("un error del sistema muestra un toast genérico sin detalles técnicos", async () => {
    crearEquipo.mockRejectedValue(
      new ApiError({
        status: 500,
        code: "ERROR_INTERNO",
        message: "java.lang.NullPointerException",
        traceId: "trz-1",
      }),
    );
    conCliente(<EquipoFormDialog abierto alCambiar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Código"), "CAM-002");
    await userEvent.type(screen.getByLabelText("Horómetro (horas)"), "5");
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: /Camión/ }));
    await userEvent.click(screen.getByRole("button", { name: "Crear equipo" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [mensaje, opciones] = vi.mocked(toast.error).mock.calls[0] ?? [];
    expect(mensaje).toBe("Algo salió mal de nuestro lado. Inténtalo de nuevo.");
    expect(JSON.stringify(opciones)).not.toContain("NullPointer");
    expect(document.body.textContent).not.toContain("NullPointer");
  });
});
