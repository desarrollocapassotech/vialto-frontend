import type { Tenant } from "@/types/api";
import {
  idPropio1Habilitado,
  idPropio2Habilitado,
  idSistemaHabilitado,
} from "@/lib/viajesFlota";

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
  { id: "origenDestino", label: "Origen — Destino" },
  { id: "cargaDescarga", label: "Fecha" },
  // Opcional (Tenant.viajesColumnaProductosHabilitada); el label real es el
  // plural de "Producto" de la empresa (`useProductoLabels`).
  { id: "productos", label: "Productos" },
  { id: "etapa", label: "Etapa" },
  // Opcional (Tenant.viajesObservaciones); inmediatamente a la izquierda de Acciones por defecto.
  { id: "observaciones", label: "Observaciones" },
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

/**
 * Columnas que la empresa ve en la grilla de Viajes. Mismas reglas que
 * `mostrarColumna*` en `ViajesTenantPage.tsx` (si se cambia una, cambiar la
 * otra). `campoVisible` = visibilidad de un campo de Viajes en la config de
 * campos del tenant (como `useFieldConfig("viajes").isVisible`).
 */
export function columnasViajesHabilitadas(
  tenant:
    | Pick<
        Tenant,
        | "idSistemaHabilitado"
        | "idPropio1Habilitado"
        | "idPropio2Habilitado"
        | "tipoFlota"
        | "viajesColumnaProductosHabilitada"
        | "viajesObservaciones"
      >
    | null
    | undefined,
  campoVisible: (campo: string) => boolean,
): Set<ViajeColumnaId> {
  const habilitada: Record<ViajeColumnaId, boolean> = {
    idSistema: idSistemaHabilitado(tenant),
    idPropio1: idPropio1Habilitado(tenant),
    idPropio2: idPropio2Habilitado(tenant),
    cliente: true,
    transporte: (tenant?.tipoFlota ?? "mixta") !== "propia",
    chofer: campoVisible("choferId") || campoVisible("choferExternoId"),
    etapa:
      campoVisible("etapa") ||
      campoVisible("facturacionEstado") ||
      campoVisible("liquidacionEstado"),
    origenDestino: true,
    cargaDescarga: true,
    // Switch propio + el campo Productos de Viajes visible (sin productos, la
    // columna quedaría siempre vacía).
    productos:
      Boolean(tenant?.viajesColumnaProductosHabilitada) && campoVisible("productoItems"),
    // Switch propio de superadmin (Tenant.viajesObservaciones).
    observaciones: Boolean(tenant?.viajesObservaciones),
  };
  return new Set(IDS_ESTANDAR.filter((id) => habilitada[id]));
}

export function esOrdenEstandarColumnasViajes(orden: readonly ViajeColumnaId[]): boolean {
  return orden.every((id, i) => id === IDS_ESTANDAR[i]);
}
