/**
 * Límite de intentos de login por IP, hecho lo mejor posible: vive en la memoria de la instancia. El límite que de
 * verdad cuenta es el del backend (429); este solo evita llamarlo cuando alguien insiste.
 */
interface Ventana {
  fallos: number;
  desde: number;
}

export class LimitadorLogin {
  private readonly ventanas = new Map<string, Ventana>();

  constructor(
    private readonly maxIntentos = 10,
    private readonly ventanaMs = 5 * 60_000,
    private readonly maxClaves = 5_000,
  ) {}

  /** Cuántos segundos faltan para poder reintentar. Es 0 si la IP no está bloqueada. */
  bloqueadoPor(clave: string, ahora = Date.now()): number {
    const v = this.ventanas.get(clave);
    if (!v) return 0;
    if (ahora - v.desde >= this.ventanaMs) {
      this.ventanas.delete(clave);
      return 0;
    }
    return v.fallos >= this.maxIntentos ? Math.ceil((v.desde + this.ventanaMs - ahora) / 1000) : 0;
  }

  registrarFallo(clave: string, ahora = Date.now()): void {
    if (this.ventanas.size >= this.maxClaves) this.limpiar(ahora);
    const v = this.ventanas.get(clave);
    if (!v || ahora - v.desde >= this.ventanaMs)
      this.ventanas.set(clave, { fallos: 1, desde: ahora });
    else v.fallos += 1;
  }

  reiniciar(clave: string): void {
    this.ventanas.delete(clave);
  }

  private limpiar(ahora: number): void {
    for (const [clave, v] of this.ventanas)
      if (ahora - v.desde >= this.ventanaMs) this.ventanas.delete(clave);
    // Si sigue lleno después de limpiar, se descarta la entrada más antigua para que el mapa no crezca sin parar
    if (this.ventanas.size >= this.maxClaves) {
      const primera = this.ventanas.keys().next().value;
      if (primera !== undefined) this.ventanas.delete(primera);
    }
  }
}

export const limitadorLogin = new LimitadorLogin();

/** La IP del cliente según el proxy del hosting. Si no viene ninguna, todos comparten la clave "desconocida", que es más estricto. */
export function ipDelCliente(headers: Headers): string {
  const reenviada = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada && reenviada.length <= 64
    ? reenviada
    : headers.get("x-real-ip")?.trim() || "desconocida";
}
