import { useUser } from "@clerk/clerk-react";
import { isPlatformSuperadmin } from "@/lib/roleLabels";
import { CuentaCorrienteSuperadminPage } from "@/pages/CuentaCorrienteSuperadminPage";
import { CuentaCorrienteTenantPage } from "@/pages/CuentaCorrienteTenantPage";

/** Superadmin: elige empresa (solo lectura). Resto: la cuenta corriente de su empresa. */
export function CuentaCorrientePage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="py-12 text-center text-vialto-steel">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <CuentaCorrienteSuperadminPage />;
  }

  return <CuentaCorrienteTenantPage />;
}
