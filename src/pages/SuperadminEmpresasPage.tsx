import { Link } from 'react-router-dom';
import { TenantsPagination } from '@/components/superadmin/TenantsPagination';
import { TenantsTable } from '@/components/superadmin/TenantsTable';
import { TenantsToolbar } from '@/components/superadmin/TenantsToolbar';
import { usePaginatedTenants } from '@/hooks/usePaginatedTenants';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';

export function SuperadminEmpresasPage() {
  const {
    items,
    meta,
    loading,
    error,
    searchInput,
    setSearchInput,
    pageSize,
    applySearch,
    clearSearch,
    onChangePageSize,
    statusUpdatingByOrgId,
    toggleTenantEnabled,
    prevPage,
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

        <TenantsToolbar
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearch={applySearch}
          onClear={clearSearch}
        />
        <TenantsTable
          loading={loading}
          items={items}
          statusUpdatingByOrgId={statusUpdatingByOrgId}
          onToggleEnabled={toggleTenantEnabled}
        />
        <TenantsPagination
          meta={meta}
          loading={loading}
          pageSize={pageSize}
          onPageSizeChange={onChangePageSize}
          onPrev={prevPage}
          onNext={nextPage}
        />
      </div>
    </SuperadminOnly>
  );
}
