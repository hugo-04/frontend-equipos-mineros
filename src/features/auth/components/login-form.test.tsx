import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
const iniciarSesion = vi.fn();
vi.mock("../api/auth.api", () => ({ iniciarSesion: (...a: unknown[]) => iniciarSesion(...a) }));

import { LoginForm } from "./login-form";

function montar() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoginForm destino="/equipos" />
    </QueryClientProvider>,
  );
}

describe("LoginForm", () => {
  it("oculta la contraseña y el ojito la muestra y la vuelve a ocultar", async () => {
    const user = userEvent.setup();
    montar();
    const campo = screen.getByLabelText("Contraseña");
    expect(campo).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(campo).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(campo).toHaveAttribute("type", "password");
  });

  it("el ojito no envía el formulario", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(iniciarSesion).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("valida usuario y contraseña obligatorios antes de enviar", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("El usuario es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("La contraseña es obligatoria")).toBeInTheDocument();
    expect(iniciarSesion).not.toHaveBeenCalled();
  });

  it("envía las credenciales cuando el formulario es válido", async () => {
    iniciarSesion.mockResolvedValue({ ok: true, usuario: { username: "admin" } });
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByLabelText("Usuario"), "admin");
    await user.type(screen.getByLabelText("Contraseña"), "clave-de-prueba");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    await waitFor(() => expect(iniciarSesion).toHaveBeenCalled());
    expect(iniciarSesion.mock.calls[0]?.[0]).toEqual({
      username: "admin",
      password: "clave-de-prueba",
    });
  });
});

describe("LoginForm: error del servidor", () => {
  it("quita el error de credenciales al volver a enviar", async () => {
    const { ApiError } = await import("@/shared/api/api-error");
    iniciarSesion.mockRejectedValueOnce(
      new ApiError({
        status: 401,
        code: "CREDENCIALES_INVALIDAS",
        message: "Usuario o contraseña incorrectos",
      }),
    );
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByLabelText("Usuario"), "admin");
    await user.type(screen.getByLabelText("Contraseña"), "mala");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("Usuario o contraseña incorrectos")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Usuario"));
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("El usuario es obligatorio")).toBeInTheDocument();
    expect(screen.queryByText("Usuario o contraseña incorrectos")).not.toBeInTheDocument();
  });
});
