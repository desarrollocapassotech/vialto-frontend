import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  TenantForm,
  type TenantFormValues,
} from "@/components/superadmin/TenantForm";
import { CrudPageLayout } from "@/components/crud/CrudPageLayout";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import type { Tenant } from "@/types/api";
function mapTenantToForm(t: Tenant): TenantFormValues {
  return {
    name: t.name,
    clerkOrgId: t.clerkOrgId,
    idFiscal: t.idFiscal ?? "",
    modules: t.modules ?? [],
    billingStatus:
      (t.billingStatus as TenantFormValues["billingStatus"]) ?? "trial",
    maxUsers: String(t.maxUsers),
    billingRenewsAt: t.billingRenewsAt?.slice(0, 10) ?? "",
  };
}

export function SuperadminTenantEditPage() {
  const { getToken } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [values, setValues] = useState<TenantFormValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [tenantName, setTenantName] = useState("");

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
          setError(friendlyError(e, "plataforma"));
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
    if (!values.name.trim()) {
      setFieldErrors({ name: "Ingresá el nombre de la empresa." });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);

    try {
      await apiJson(
        `/api/tenants/${encodeURIComponent(orgId)}`,
        () => getToken(),
        {
          method: "PATCH",
          body: JSON.stringify({
            name: values.name.trim() || undefined,
            idFiscal: values.idFiscal.trim() || null,
            modules: values.modules,
            billingStatus: values.billingStatus,
            maxUsers: values.maxUsers ? Number(values.maxUsers) : undefined,
            billingRenewsAt: values.billingRenewsAt || null,
          }),
        },
      );

      showToast("Empresa actualizada exitosamente", "success");
      navigate("/superadmin/empresas", { replace: true });
    } catch (e) {
      setError(friendlyError(e, "plataforma"));

      showToast("No se pudo actualizar la empresa", "error");
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
      await apiJson(
        `/api/tenants/${encodeURIComponent(orgId)}`,
        () => getToken(),
        {
          method: "DELETE",
        },
      );
      showToast("Empresa eliminada correctamente", "success");
      navigate("/superadmin/empresas", { replace: true });
    } catch (e) {
      setError(friendlyError(e, "plataforma"));
      showToast("Ocurrió un error al intentar eliminar", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <SuperadminOnly>
      <CrudPageLayout title="Editar empresa" contentClassName="w-full min-w-0">
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
              fieldErrors={fieldErrors}
              formError={error}
            />

            <section className="mt-6 rounded border border-red-300 bg-red-50 p-5 sm:p-6">
              <h2 className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-red-800">
                Danger Zone
              </h2>
              <p className="mt-2 text-sm text-red-900">
                Esta acción elimina la empresa y sus datos asociados en la
                plataforma.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-red-800">
                    Escribí <strong>{tenantName}</strong> para confirmar
                  </span>
                  <input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    className="h-10 w-full max-w-sm border border-red-300 bg-white px-3 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={!canDelete || deleteLoading}
                  onClick={onDelete}
                  className="h-10 shrink-0 px-4 bg-red-700 text-white text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  {deleteLoading ? "Eliminando…" : "Eliminar empresa"}
                </button>
              </div>
            </section>
          </>
        )}
      </CrudPageLayout>
    </SuperadminOnly>
  );
}
