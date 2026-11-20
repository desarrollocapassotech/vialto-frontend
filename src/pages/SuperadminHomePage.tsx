import { Link } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useTenantsList } from "@/hooks/useTenantsList";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";

/**
 * Inicio del superadmin. Versión mínima (nov 2026): las tarjetas por estado de
 * suscripción se fueron junto con la suscripción (se maneja en otro sistema).
 * Pendiente de rediseño.
 */
export function SuperadminHomePage() {
  const tenants = useTenantsList();

  return (
    <SuperadminOnly>
      <div className="w-full">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal md:text-5xl">
          Panorama general
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
          <Link
            to="/superadmin/empresas"
            className="group flex items-center justify-between gap-4 rounded border border-black/10 bg-white p-5 hover:border-black/20"
          >
            <div>
              <p className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
                Empresas
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-4xl tabular-nums text-vialto-charcoal">
                {tenants === null ? "—" : tenants.length}
              </p>
            </div>
            <Building2
              className="h-6 w-6 shrink-0 text-vialto-steel group-hover:text-vialto-charcoal"
              strokeWidth={1.75}
              aria-hidden
            />
          </Link>
          <Link
            to="/superadmin/empresas/nueva"
            className="group flex items-center justify-between gap-4 rounded border border-black/10 bg-white p-5 hover:border-black/20"
          >
            <div>
              <p className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
                Acceso directo
              </p>
              <p className="mt-1 text-lg text-vialto-charcoal">Crear empresa</p>
            </div>
            <Plus
              className="h-6 w-6 shrink-0 text-vialto-steel group-hover:text-vialto-charcoal"
              strokeWidth={1.75}
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </SuperadminOnly>
  );
}
