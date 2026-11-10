import { useTenantPaisFijo } from "@/hooks/useTenantPaisFijo";
import { transportistaLabels, type TransportistaLabels } from "@/lib/transportistaLabel";

/**
 * Nombre que la empresa le da al transportista externo (ver `lib/transportistaLabel.ts`).
 * `tenantId` = override de superadmin (empresa elegida); sin él, la empresa propia.
 * Mientras el tenant no cargó devuelve el default ("Transportista").
 */
export function useTransportistaLabels(tenantId?: string): TransportistaLabels {
  const { tenant } = useTenantPaisFijo(tenantId || undefined);
  return transportistaLabels(tenant);
}
