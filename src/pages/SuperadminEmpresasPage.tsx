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
        {/* Título a la izquierda; acciones a la derecha, en la misma línea. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
              Empresas
            </h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/superadmin/empresas/nueva"
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              Crear empresa
            </Link>
          </div>
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
