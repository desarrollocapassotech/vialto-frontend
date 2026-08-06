import { Link } from "react-router-dom";
import { TenantsTable } from "@/components/superadmin/TenantsTable";
import { usePaginatedTenants } from "@/hooks/usePaginatedTenants";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import { ListadoPagination } from "@/components/listado/ListadoPagination";

export function SuperadminEmpresasPage() {
  const {
    items,
    meta,
    loading,
    error,
    pageSize,
    onChangePageSize,
    statusUpdatingByOrgId,
    toggleTenantEnabled,
    nextPage,
  } = usePaginatedTenants();

  return (
    <SuperadminOnly>
      <div className="w-full">
        <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
          Empresas
        </h1>
        <p className="mt-2 text-vialto-steel max-w-2xl">
          Listado completo de empresas registradas.
        </p>
        <div className="mt-4 flex justify-end">
          <Link
            to="/superadmin/empresas/nueva"
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Crear empresa
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

        <TenantsTable
          loading={loading}
          items={items}
          statusUpdatingByOrgId={statusUpdatingByOrgId}
          onToggleEnabled={toggleTenantEnabled}
        />

        {meta && (
          <ListadoPagination
            meta={meta}
            pageSize={pageSize}
            loading={loading}
            totalLabel="empresas"
            onPageChange={nextPage}
            onPageSizeChange={onChangePageSize}
          />
        )}
      </div>
    </SuperadminOnly>
  );
}
