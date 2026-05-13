import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { FacturacionTenantPage } from '@/pages/FacturacionTenantPage';

type FacturaNuevaNavState = {
  tenantId?: string;
  newFacturaDraft?: { clienteId: string; viajeIds: string[] };
  expandFacturaId?: string;
};

export function FacturacionSuperadminPage() {
  const location = useLocation();
  const tenants = useTenantsList();
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  useEffect(() => {
    const state = location.state as FacturaNuevaNavState | null;
    if (state?.tenantId) setFiltroEmpresa(state.tenantId);
  }, [location.state]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Facturación
      </h1>
      <p className="mt-2 text-vialto-steel">
        Vista de plataforma — seleccioná una empresa para ver y administrar sus facturas con las mismas herramientas que un admin de la empresa.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={(v) => setFiltroEmpresa(v)}
        />
      </div>

      {!filtroEmpresa && (
        <p className="mt-10 text-vialto-steel text-sm">
          Seleccioná una empresa para ver sus facturas.
        </p>
      )}

      {filtroEmpresa ? (
        <div className="mt-8">
          <FacturacionTenantPage tenantId={filtroEmpresa} embeddedInSuperadmin />
        </div>
      ) : null}
    </div>
  );
}
