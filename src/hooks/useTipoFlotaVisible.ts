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
 * `defaultCreacion` (`Tenant.tipoFlotaDefault`, solo con flota mixta): qué
 * opción viene marcada al crear un Viaje/Chofer/Vehículo. `null` = cada
 * formulario usa su default de siempre. `tenantCargado` dice si ya se puede
 * aplicar (para no pisar lo que el usuario eligió antes de que cargue).
 *
 * `tenantId` es el override de superadmin, igual que en `useTenantPaisFijo`.
 */
export function useTipoFlotaVisible(tenantId?: string) {
  const { tenant } = useTenantPaisFijo(tenantId);
  const tipoFlota = tenant?.tipoFlota ?? "mixta";
  const defaultCreacion: "propia" | "externa" | null =
    tipoFlota === "mixta" ? (tenant?.tipoFlotaDefault ?? null) : null;
  return {
    flotaPropiaVisible: tipoFlota !== "externa",
    transportistaExternoVisible: tipoFlota !== "propia",
    defaultCreacion,
    tenantCargado: tenant != null,
  };
}
