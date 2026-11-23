import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from "@clerk/clerk-react";
import { isPlatformSuperadmin } from "@/lib/roleLabels";
import { CuentaCorrienteSuperadminPage } from "@/pages/CuentaCorrienteSuperadminPage";
import { CuentaCorrienteTenantPage } from "@/pages/CuentaCorrienteTenantPage";
import { usePermisosRol } from "@/hooks/usePermisosRol";

/**
 * Superadmin: elige empresa (solo lectura). Resto: la cuenta corriente de su empresa,
 * en solo lectura si su rol no opera Cuenta corriente (matriz `lib/permisosRol.ts`).
 */
export function CuentaCorrientePage() {
  const { user, isLoaded } = useUser();
  const { puedeOperar } = usePermisosRol();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando cuenta corriente…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <CuentaCorrienteSuperadminPage />;
  }

  return <CuentaCorrienteTenantPage soloLectura={!puedeOperar("cuentaCorriente")} />;
}
