const numero = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
// Hora de Perú (UTC-5, sin horario de verano). Es fija a propósito: así el servidor y el navegador muestran
// lo mismo y no hay diferencias al hidratar la página.
const ZONA_HORARIA = "America/Lima";
const fechaHora = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZONA_HORARIA,
});

export function formatearHorometro(valor: number): string {
  return `${numero.format(valor)} h`;
}

// Las fechas del backend vienen en UTC y se muestran en hora de Perú
export function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "—" : fechaHora.format(fecha);
}
