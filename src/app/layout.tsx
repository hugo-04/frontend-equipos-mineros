import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { QueryProvider } from "@/shared/providers/query-provider";
import { Notificaciones, ThemeProvider } from "@/shared/providers/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Equipos mineros", template: "%s · Equipos mineros" },
  description: "Registro de equipos mineros y control de mantenimiento por horómetro",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El nonce de la CSP lo genera src/proxy.ts; se usa para el script inline del tema
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider nonce={nonce}>
          <QueryProvider>
            {children}
            <Notificaciones />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
