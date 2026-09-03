import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import { ImportTemplatesConfig } from "@/components/importacion/ImportTemplatesConfig";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type { Tenant } from "@/types/api";

/**
 * Pantalla standalone de configuración de templates — llegada desde el
 * wizard de import (link "Configurar templates" / error de "columnas
 * faltantes") o desde la sección embebida en "Configuración por empresa"
 * (`CamposEmpresaPage`, que abre esta misma ruta con el tenant ya elegido).
 * La lógica real vive en `ImportTemplatesConfig` — este componente solo
 * resuelve el tenant a partir de `:orgId`.
 */
export function SuperadminImportTemplatesPage() {
  const { getToken } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();
  const moduloParam = searchParams.get("modulo");

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setTenantLoading(true);
    setTenantError(null);
    (async () => {
      try {
        const t = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(orgId)}`,
          () => getToken(),
        );
        if (!cancelled) setTenant(t);
      } catch (e) {
        if (!cancelled) setTenantError(friendlyError(e, "plataforma"));
      } finally {
        if (!cancelled) setTenantLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, orgId]);

  return (
    <SuperadminOnly>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          Configurar templates de importación
        </h1>
        {tenant && <p className="mt-2 text-vialto-steel">{tenant.name}</p>}

        {tenantLoading && (
          <p className="mt-6 text-sm text-vialto-steel">Cargando empresa…</p>
        )}
        {tenantError && <p className="mt-6 text-sm text-red-600">{tenantError}</p>}

        {!tenantLoading && tenant && orgId && (
          <div className="mt-6">
            <ImportTemplatesConfig
              tenantId={orgId}
              tenantNombre={tenant.name}
              tenantModules={tenant.modules}
              initialModulo={moduloParam}
              embedded
            />
          </div>
        )}
      </div>
    </SuperadminOnly>
  );
}
