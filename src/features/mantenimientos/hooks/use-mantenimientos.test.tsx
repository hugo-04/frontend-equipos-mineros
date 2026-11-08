import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
const registrarMantenimiento = vi.fn();
vi.mock("../api/mantenimientos.api", () => ({
  registrarMantenimiento: (...a: unknown[]) => registrarMantenimiento(...a),
  listarMantenimientos: vi.fn(),
}));

import { equipoKeys } from "@/features/equipos";
import { useRegistrarMantenimiento } from "./use-mantenimientos";

describe("useRegistrarMantenimiento", () => {
  it("al registrar invalida el detalle, el historial y la lista del equipo", async () => {
    registrarMantenimiento.mockResolvedValue({ id: 1 });
    const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(cliente, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRegistrarMantenimiento(9), { wrapper });

    await act(async () => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(invalidar).toHaveBeenCalledTimes(3));
    const claves = invalidar.mock.calls.map((c) => c[0]?.queryKey);
    expect(claves).toContainEqual(equipoKeys.detail(9));
    expect(claves).toContainEqual(equipoKeys.mantenimientos(9));
    expect(claves).toContainEqual(equipoKeys.list());
  });
});
