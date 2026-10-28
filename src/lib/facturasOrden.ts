import type { Factura } from "@/types/api";
import { importeACobrarFactura } from "@/lib/facturaTotales";
import type { ValorOrden } from "@/lib/ordenListado";

/** Columnas ordenables de la grilla de Facturas. Espejo de `FACTURAS_SORT_FIELDS` del backend. */
export type FacturaSortField =
  | "numero"
  | "cliente"
  | "emision"
  | "vencimiento"
  | "estado"
  | "importe";

const ESTADO_ORDEN: Record<string, number> = {
  borrador: 1,
  esperando_afip: 2,
  facturado: 3,
  error_afip: 4,
  anulado: 5,
};

function fechaMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Claves de orden de una factura (superadmin, que ordena en el navegador). Mismas
 * que `FacturacionService.ordenarFacturas` del backend.
 */
export function clavesOrdenFactura(
  f: Factura,
  sortBy: FacturaSortField,
  nombreCliente: (id: string | null | undefined) => string,
  hasArca: boolean,
): ValorOrden[] {
  switch (sortBy) {
    case "numero":
      return [f.numero];
    case "cliente":
      return [f.clienteId ? nombreCliente(f.clienteId) : null];
    case "emision":
      return [fechaMs(f.fechaEmision)];
    case "vencimiento":
      return [fechaMs(f.fechaVencimiento)];
    case "estado":
      return [ESTADO_ORDEN[f.estado ?? ""] ?? 9, f.cobrado ? 1 : 0];
    case "importe":
      return [importeACobrarFactura(f, hasArca)];
  }
}
