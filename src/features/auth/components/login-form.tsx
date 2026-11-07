"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CampoFormulario, propsAccesibles } from "@/shared/components/campo-formulario";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useLogin } from "../hooks/use-auth";
import { loginSchema, type LoginValues } from "../schemas/login.schema";

/** Formulario de login. Valida con Zod antes de enviar y deja los errores del backend junto a cada campo. */
export function LoginForm({ destino }: { destino: string }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const login = useLogin(destino, () => ({
    campos: ["username", "password"],
    ponerErrorEnCampo: (campo, mensaje) =>
      setError(campo as keyof LoginValues, { message: mensaje }),
  }));

  return (
    <form
      onSubmit={handleSubmit((valores) => login.mutate(valores))}
      noValidate
      className="space-y-4"
    >
      <CampoFormulario id="username" etiqueta="Usuario" error={errors.username?.message}>
        <Input
          {...propsAccesibles("username", errors.username?.message)}
          autoComplete="username"
          autoCapitalize="none"
          disabled={login.isPending}
          {...register("username")}
        />
      </CampoFormulario>
      <CampoFormulario id="password" etiqueta="Contraseña" error={errors.password?.message}>
        <Input
          {...propsAccesibles("password", errors.password?.message)}
          type="password"
          autoComplete="current-password"
          disabled={login.isPending}
          {...register("password")}
        />
      </CampoFormulario>
      {login.isError && login.error instanceof Error && login.error.name === "ApiError" && (
        <p role="alert" className="text-destructive text-sm">
          {/* El mensaje del backend es genérico a propósito: no dice si el usuario existe */}
          {(login.error as Error).message || "No se pudo iniciar sesión"}
        </p>
      )}
      <Button type="submit" className="w-full" cargando={login.isPending}>
        {login.isPending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
