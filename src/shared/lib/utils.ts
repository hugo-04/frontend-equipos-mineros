import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta clases de Tailwind y resuelve los conflictos: gana la última. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
