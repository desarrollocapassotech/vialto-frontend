import { ApiError } from "./api";

/**
 * Extrae el detalle técnico completo (respuesta cruda de AFIP SDK) que el backend
 * adjunta en el body del error (`{ message, detalle }`), para el botón "ver error completo".
 */
export function getArcaErrorDetalle(err: unknown): string | undefined {
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    const d = (err.body as { detalle?: unknown }).detalle;
    if (typeof d === "string" && d.trim()) return d.trim();
  }
  return undefined;
}
