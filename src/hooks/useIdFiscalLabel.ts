import { idFiscalPorPais } from "@/lib/ciudades";
import { useTenantPaisFijo } from "@/hooks/useTenantPaisFijo";

/**
 * Nombre del identificador fiscal para encabezados y filtros de listados:
 * el del país fijo del tenant (ej. "CUIT / CUIL" para AR) o el genérico
 * "ID Fiscal" si la empresa trabaja con varios países.
 *
 * `tenantId` es el override de superadmin, igual que en `useTenantPaisFijo`.
 */
export function useIdFiscalLabel(tenantId?: string): string {
  const { paisFijo } = useTenantPaisFijo(tenantId);
  return idFiscalPorPais(paisFijo ?? "").label;
}
