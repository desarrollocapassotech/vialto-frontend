import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import { ImportWizard } from "@/components/importacion/ImportWizard";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type { Tenant } from "@/types/api";

export function SuperadminImportarPage() {
  const { getToken } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const t = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(orgId)}`,
          () => getToken(),
        );
        if (!cancelled) setTenant(t);
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "plataforma"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, orgId]);

  return (
    <SuperadminOnly>
      <div>
        {(loading || error) && (
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
            Importar datos
          </h1>
        )}
        {loading && (
          <p className="mt-6 text-sm text-vialto-steel">Cargando empresa…</p>
        )}
        {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

        {!loading && tenant && orgId && (
          <ImportWizard
            tenantId={orgId}
            tenantModules={tenant.modules}
            backTo="/superadmin/empresas"
            viajesTo={`/viajes?tenantId=${encodeURIComponent(orgId)}`}
            templatesTo={`/superadmin/empresas/${orgId}/importar/templates`}
            encabezado={
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
                  Importar datos
                </h1>
                <p className="text-sm text-vialto-steel">{tenant.name}</p>
              </div>
            }
            acciones={
              <Link
                className="shrink-0 whitespace-nowrap border border-vialto-fire bg-vialto-fire px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm hover:bg-vialto-bright hover:border-vialto-bright"
                to={`/superadmin/empresas/${orgId}/importar/templates`}
              >
                Configurar templates →
              </Link>
            }
          />
        )}
      </div>
    </SuperadminOnly>
  );
}
