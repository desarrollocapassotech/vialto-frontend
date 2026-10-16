import type { Tenant } from "@/types/api";

/**
 * Columnas reordenables de la grilla de Viajes, en su orden estándar.
 * Espejo de `VIAJES_COLUMNAS_ORDENABLES` en el backend
 * (`core/tenants/dto/update-tenant.dto.ts`): si se agrega una columna a la
 * grilla, sumarla en los dos lados. La selección en lote (primera) y Acciones
 * (última) quedan fijas, no se ordenan.
 */
export const VIAJES_COLUMNAS = [
  { id: "idSistema", label: "ID sistema" },
  { id: "idPropio1", label: "ID propio 1" },
  { id: "idPropio2", label: "ID propio 2" },
  { id: "cliente", label: "Cliente" },
  { id: "transporte", label: "Transporte" },
  { id: "chofer", label: "Chofer" },
  { id: "etapa", label: "Etapa" },
  { id: "origenDestino", label: "Origen — Destino" },
  { id: "cargaDescarga", label: "Carga — Descarga" },
] as const;

export type ViajeColumnaId = (typeof VIAJES_COLUMNAS)[number]["id"];

const IDS_ESTANDAR: ViajeColumnaId[] = VIAJES_COLUMNAS.map((c) => c.id);

/**
 * Normaliza un orden guardado: descarta ids desconocidos o repetidos y agrega
 * al final, en su orden estándar, las columnas que falten (ej. una columna
 * nueva que todavía no estaba cuando se guardó el orden).
 */
export function normalizarOrdenColumnasViajes(
  orden: readonly string[] | null | undefined,
): ViajeColumnaId[] {
  const resultado: ViajeColumnaId[] = [];
  for (const id of orden ?? []) {
    if ((IDS_ESTANDAR as string[]).includes(id) && !resultado.includes(id as ViajeColumnaId)) {
      resultado.push(id as ViajeColumnaId);
    }
  }
  for (const id of IDS_ESTANDAR) {
    if (!resultado.includes(id)) resultado.push(id);
  }
  return resultado;
}

/** `Tenant.viajesColumnasOrden` normalizado ([] o sin tenant = orden estándar). */
export function ordenColumnasViajes(tenant: Tenant | null | undefined): ViajeColumnaId[] {
  return normalizarOrdenColumnasViajes(tenant?.viajesColumnasOrden);
}

export function esOrdenEstandarColumnasViajes(orden: readonly ViajeColumnaId[]): boolean {
  return orden.every((id, i) => id === IDS_ESTANDAR[i]);
}
