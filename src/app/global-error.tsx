"use client";

/** Último recurso, para cuando falla el propio layout raíz. Por eso no usa los estilos ni los proveedores de la app. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          margin: 0,
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Algo salió mal de nuestro lado. Inténtalo de nuevo.</h1>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "8px 16px", fontSize: 16 }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
