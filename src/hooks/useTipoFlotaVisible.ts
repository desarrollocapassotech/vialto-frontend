import { useTenantPaisFijo } from "@/hooks/useTenantPaisFijo";

/**
 * Qué tipos de flota usa la empresa, según `Tenant.tipoFlota` (lo configura
 * el superadmin en Campos por empresa → General).
 *
 * Una empresa solo de flota propia no ve la pestaña Transportistas, ni la
 * opción "Transportista externo" en Choferes/Vehículos, ni "Transporte
 * externo" al cargar un viaje (y al revés para una empresa solo externa).
 * Mientras el tenant no cargó, o sin tenant (superadmin sin empresa elegida),
 * se muestran las dos opciones.
 *
 * `tenantId` es el override de superadmin, igual que en `useTenantPaisFijo`.
 */
export function useTipoFlotaVisible(tenantId?: string) {
  const { tenant } = useTenantPaisFijo(tenantId);
  const tipoFlota = tenant?.tipoFlota ?? "mixta";
  return {
    flotaPropiaVisible: tipoFlota !== "externa",
    transportistaExternoVisible: tipoFlota !== "propia",
  };
}
