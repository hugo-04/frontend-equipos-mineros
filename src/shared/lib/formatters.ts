const numero = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fechaHora = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatearHorometro(valor: number): string {
  return `${numero.format(valor)} h`;
}

export function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "—" : `${fechaHora.format(fecha)} UTC`;
}
