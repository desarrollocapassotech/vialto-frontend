import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { CombustibleTenantPage } from "@/pages/CombustibleTenantPage"; // Ajustar el path según tu proyecto

export function CombustibleSuperadminPage() {
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Combustible
      </h1>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={onChangeTenant}
        />
      </div>

      {!filtroEmpresa && (
        <p className="mt-10 text-vialto-steel text-sm">
          Seleccioná una empresa para ver sus cargas de combustible.
        </p>
      )}

      {filtroEmpresa ? (
        <div className="mt-8">
          <CombustibleTenantPage
            tenantId={filtroEmpresa}
            embeddedInSuperadmin
          />
        </div>
      ) : null}
    </div>
  );
}
