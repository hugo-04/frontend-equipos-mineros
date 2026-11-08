import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/api-error";
import type { Equipo } from "../types";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

const actualizarEquipo = vi.fn();
vi.mock("../api/equipos.api", () => ({
  crearEquipo: vi.fn(),
  actualizarEquipo: (...a: unknown[]) => actualizarEquipo(...a),
  eliminarEquipo: vi.fn(),
  listarEquipos: vi.fn(),
  obtenerEquipo: vi.fn(),
}));
vi.mock("@/features/tipos", () => ({
  useTipos: () => ({ isPending: false, data: [{ id: 1, nombre: "Camión", intervaloHoras: 250 }] }),
  tipoEquipoSchema: { parse: (x: unknown) => x },
}));

import { EquipoFormDialog } from "./equipo-form-dialog";

const equipo: Equipo = {
  id: 7,
  codigo: "CAM-007",
  tipo: { id: 1, nombre: "Camión", intervaloHoras: 250 },
  horometro: 200,
  horometroUltimoMant: 0,
  horasDesdeUltimoMant: 200,
  horasRestantes: 50,
  requiereMantenimiento: false,
  estado: "OK",
  creadoEn: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  actualizarEquipo.mockReset();
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

function montar() {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={cliente}>
      <EquipoFormDialog abierto alCambiar={vi.fn()} equipo={equipo} />
    </QueryClientProvider>,
  );
}

// El tipo es inmutable: al editar se muestra de solo lectura y nunca viaja en la actualización
describe("EquipoFormDialog al editar", () => {
  it("muestra el tipo como dato de solo lectura con la nota de por qué no se cambia", () => {
    montar();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Camión · cada 250 h")).toBeInTheDocument();
    expect(
      screen.getByText(
        "El tipo no se puede cambiar. Si te equivocaste, elimina el equipo y créalo de nuevo.",
      ),
    ).toBeInTheDocument();
  });

  it("muestra el mínimo permitido del horómetro (el valor actual)", () => {
    montar();
    expect(screen.getByText(/Mínimo permitido: 200\.0 h/)).toBeInTheDocument();
    expect(screen.getByLabelText("Horómetro (horas)")).toHaveValue("200");
  });

  it("al guardar manda solo código y horómetro, sin tipoId", async () => {
    actualizarEquipo.mockResolvedValue(equipo);
    montar();
    await userEvent.clear(screen.getByLabelText("Horómetro (horas)"));
    await userEvent.type(screen.getByLabelText("Horómetro (horas)"), "260.5");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(actualizarEquipo).toHaveBeenCalledTimes(1));
    expect(actualizarEquipo).toHaveBeenCalledWith(7, { codigo: "CAM-007", horometro: 260.5 });
    expect(actualizarEquipo.mock.calls[0]?.[1]).not.toHaveProperty("tipoId");
  });

  it("rechaza un horómetro menor al actual sin llamar al API", async () => {
    montar();
    await userEvent.clear(screen.getByLabelText("Horómetro (horas)"));
    await userEvent.type(screen.getByLabelText("Horómetro (horas)"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("El horómetro no puede ser menor al actual (200)"),
    ).toBeInTheDocument();
    expect(actualizarEquipo).not.toHaveBeenCalled();
  });

  it("HOROMETRO_NO_PUEDE_BAJAR del backend se marca en el campo horómetro, no como error de sistema", async () => {
    actualizarEquipo.mockRejectedValue(
      new ApiError({
        status: 422,
        code: "HOROMETRO_NO_PUEDE_BAJAR",
        message: "El horómetro no puede bajar: actual 300.0, recibido 250.0",
      }),
    );
    montar();
    await userEvent.clear(screen.getByLabelText("Horómetro (horas)"));
    await userEvent.type(screen.getByLabelText("Horómetro (horas)"), "250");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    // El formulario deja pasar 250 porque el equipo del test tiene 200; el backend (con otro valor) lo rechaza
    expect(
      await screen.findByText("El horómetro no puede bajar: actual 300.0, recibido 250.0", {
        selector: "p",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Horómetro (horas)")).toHaveAttribute("aria-invalid", "true");
    expect(toast.warning).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("TIPO_NO_MODIFICABLE se avisa con un toast de advertencia, no como error de sistema", async () => {
    actualizarEquipo.mockRejectedValue(
      new ApiError({
        status: 422,
        code: "TIPO_NO_MODIFICABLE",
        message: "El tipo de un equipo no se puede cambiar.",
      }),
    );
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("El tipo de un equipo no se puede cambiar."),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("un código repetido (409) se marca en el campo código", async () => {
    actualizarEquipo.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "CODIGO_DUPLICADO",
        message: "El código CAM-009 ya existe",
      }),
    );
    montar();
    await userEvent.clear(screen.getByLabelText("Código"));
    await userEvent.type(screen.getByLabelText("Código"), "CAM-009");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("El código CAM-009 ya existe", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Código")).toHaveAttribute("aria-invalid", "true");
  });
});
