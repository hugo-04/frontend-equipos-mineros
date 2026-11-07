/**
 * A06: límite de intentos de login por IP, de mejor esfuerzo (memoria de la instancia). El límite fuerte
 * lo impone el backend (429); este evita siquiera llamarlo cuando alguien insiste.
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

  /** Segundos que faltan para poder reintentar (0 si no está bloqueado) */
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
    if (!v || ahora - v.desde >= this.ventanaMs) this.ventanas.set(clave, { fallos: 1, desde: ahora });
    else v.fallos += 1;
  }

  reiniciar(clave: string): void {
    this.ventanas.delete(clave);
  }

  private limpiar(ahora: number): void {
    for (const [clave, v] of this.ventanas) if (ahora - v.desde >= this.ventanaMs) this.ventanas.delete(clave);
    // Si aun así está lleno, se descarta lo más antiguo para no crecer sin límite
    if (this.ventanas.size >= this.maxClaves) {
      const primera = this.ventanas.keys().next().value;
      if (primera !== undefined) this.ventanas.delete(primera);
    }
  }
}

export const limitadorLogin = new LimitadorLogin();

/** IP del cliente según el proxy de confianza del hosting; si no hay, una clave común (más estricto) */
export function ipDelCliente(headers: Headers): string {
  const reenviada = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada && reenviada.length <= 64 ? reenviada : headers.get("x-real-ip")?.trim() || "desconocida";
}
