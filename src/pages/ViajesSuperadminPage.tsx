import { useTenantFiltroUrl } from '@/hooks/useTenantFiltroUrl';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { ViajesTenantPage } from '@/pages/ViajesTenantPage';

export function ViajesSuperadminPage() {
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  
  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Viajes
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Vista de plataforma — seleccioná una empresa para listar y administrar viajes con las mismas herramientas que un admin de la empresa.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar tenants={tenants} value={filtroEmpresa} onChange={onChangeTenant} />
      </div>

      {!filtroEmpresa && (
        <p className="mt-10 text-vialto-steel text-sm">
          Seleccioná una empresa para ver los viajes.
        </p>
      )}

      {filtroEmpresa ? (
        <div className="mt-8">
          <ViajesTenantPage tenantId={filtroEmpresa} embeddedInSuperadmin />
        </div>
      ) : null}
    </div>
  );
}
