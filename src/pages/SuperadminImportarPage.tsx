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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
              Importar datos
            </h1>
            {tenant && <p className="mt-2 text-vialto-steel">{tenant.name}</p>}
          </div>
          {orgId && (
            <Link
              className="whitespace-nowrap text-sm text-vialto-fire hover:text-vialto-bright"
              to={`/superadmin/empresas/${orgId}/importar/templates`}
            >
              Configurar templates →
            </Link>
          )}
        </div>

        <div className="mt-4">
          <Link
            className="text-sm text-vialto-fire hover:text-vialto-bright"
            to="/superadmin/empresas"
          >
            ← Volver a empresas
          </Link>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-vialto-steel">Cargando empresa…</p>
        )}
        {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

        {!loading && tenant && orgId && (
          <div className="mt-6">
            <ImportWizard
              tenantId={orgId}
              tenantModules={tenant.modules}
              backTo="/superadmin/empresas"
              templatesTo={`/superadmin/empresas/${orgId}/importar/templates`}
            />
          </div>
        )}
      </div>
    </SuperadminOnly>
  );
}
