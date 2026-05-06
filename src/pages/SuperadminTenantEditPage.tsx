import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TenantForm, type TenantFormValues } from '@/components/superadmin/TenantForm';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Tenant } from '@/types/api';

function mapTenantToForm(t: Tenant): TenantFormValues {
  return {
    name: t.name,
    clerkOrgId: t.clerkOrgId,
    idFiscal: t.idFiscal ?? '',
    modules: t.modules ?? [],
    billingStatus: (t.billingStatus as TenantFormValues['billingStatus']) ?? 'trial',
    maxUsers: String(t.maxUsers),
    billingRenewsAt: t.billingRenewsAt?.slice(0, 10) ?? '',
    whiteLabelDomain: t.whiteLabelDomain ?? '',
  };
}

export function SuperadminTenantEditPage() {
  const { getToken } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [values, setValues] = useState<TenantFormValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    (async () => {
      try {
        const tenant = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(orgId)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setValues(mapTenantToForm(tenant));
          setTenantName(tenant.name);
        }
      } catch (e) {
        if (!cancelled) {
          setError(friendlyError(e, 'plataforma'));
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, orgId]);

  async function onSubmit() {
    if (!orgId || !values) return;
    setLoading(true);
    setError(null);
    try {
      await apiJson(`/api/tenants/${encodeURIComponent(orgId)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name.trim() || undefined,
          idFiscal: values.idFiscal.trim() || null,
          modules: values.modules,
          billingStatus: values.billingStatus,
          maxUsers: values.maxUsers ? Number(values.maxUsers) : undefined,
          billingRenewsAt: values.billingRenewsAt || null,
          whiteLabelDomain: values.whiteLabelDomain?.trim() || null,
        }),
      });
      navigate('/', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setLoading(false);
    }
  }

  const canDelete =
    tenantName.trim().length > 0 && deleteConfirm.trim() === tenantName;

  async function onDelete() {
    if (!orgId || !canDelete) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await apiJson(`/api/tenants/${encodeURIComponent(orgId)}`, () => getToken(), {
        method: 'DELETE',
      });
      navigate('/', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <SuperadminOnly>
      <div className="max-w-4xl">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          Editar empresa
        </h1>
        <p className="mt-2 text-vialto-steel">
          Actualizá módulos y configuración comercial de la empresa.
        </p>

        <div className="mt-4">
          <Link className="text-sm text-vialto-fire hover:text-vialto-bright" to="/">
            ← Volver a panorama
          </Link>
        </div>

        {error && (
          <div
            className="mt-6 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            {error}
          </div>
        )}

        {initialLoading && (
          <p className="mt-6 text-sm text-vialto-steel">Cargando empresa…</p>
        )}

        {!initialLoading && values && (
          <>
            <TenantForm
              values={values}
              onChange={setValues}
              onSubmit={onSubmit}
              submitLabel="Guardar cambios"
              loading={loading}
              includeAdvancedFields
              disableOrgId
            />

            <section className="mt-10 border border-red-300 bg-red-50 p-5">
              <h2 className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-red-800">
                Danger Zone
              </h2>
              <p className="mt-2 text-sm text-red-900">
                Esta acción elimina la empresa y sus datos asociados en la
                plataforma.
              </p>
              <p className="mt-2 text-xs text-red-800">
                Escribí <strong>{tenantName}</strong> para confirmar.
              </p>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-3 h-10 w-full border border-red-300 bg-white px-3 text-sm"
              />
              <button
                type="button"
                disabled={!canDelete || deleteLoading}
                onClick={onDelete}
                className="mt-3 h-10 px-4 bg-red-700 text-white text-sm uppercase tracking-wider disabled:opacity-50"
              >
                {deleteLoading ? 'Eliminando…' : 'Eliminar empresa'}
              </button>
            </section>
          </>
        )}
      </div>
    </SuperadminOnly>
  );
}
