"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CampoFormulario, propsAccesibles } from "@/shared/components/campo-formulario";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PasswordInput } from "@/shared/components/ui/password-input";
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
      // Sin method, si el formulario se envía antes de que cargue JavaScript el navegador usa GET y la clave
      // viaja en la URL. Con POST nunca queda en la URL; con JavaScript, onSubmit la manda por la API.
      method="post"
      onSubmit={(evento) => {
        // El error del intento anterior se quita al volver a enviar, así no queda junto a los errores nuevos
        login.reset();
        return handleSubmit((valores) => login.mutate(valores))(evento);
      }}
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
        <PasswordInput
          {...propsAccesibles("password", errors.password?.message)}
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
