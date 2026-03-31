import { TenantsPagination } from '@/components/superadmin/TenantsPagination';
import { TenantsStatsCards } from '@/components/superadmin/TenantsStatsCards';
import { TenantsTable } from '@/components/superadmin/TenantsTable';
import { TenantsToolbar } from '@/components/superadmin/TenantsToolbar';
import { usePaginatedTenants } from '@/hooks/usePaginatedTenants';
import { Link } from 'react-router-dom';

export function SuperadminHomePage() {
  const {
    items,
    meta,
    loading,
    error,
    searchInput,
    setSearchInput,
    pageSize,
    stats,
    applySearch,
    clearSearch,
    onChangePageSize,
    statusUpdatingByOrgId,
    toggleTenantEnabled,
    prevPage,
    nextPage,
  } = usePaginatedTenants();

  return (
    <div className="max-w-6xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
        Panorama general
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

      <TenantsStatsCards loading={loading} stats={stats} />
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
  );
}
