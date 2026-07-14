import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { StockPanelTenantPage } from './StockPanelTenantPage';

export function StockPanelSuperadminPage() {
  const tenants = useTenantsList();
  const [searchParams, setSearchParams] = useSearchParams();
  const tidFromUrl = searchParams.get('tenantId') ?? '';
  const [tenantId, setTenantId] = useState(tidFromUrl);

  useEffect(() => {
    const t = searchParams.get('tenantId') ?? '';
    setTenantId(t);
  }, [searchParams]);

  const handleTenantChange = useCallback(
    (v: string) => {
      setTenantId(v);
      if (v) setSearchParams({ tenantId: v });
      else setSearchParams({});
    },
    [setSearchParams],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-vialto-charcoal">Inventario</h1>
        <p className="mt-1 text-sm text-vialto-steel">
          Stock disponible de la empresa seleccionada, por depósito.
        </p>
      </div>

      <EmpresaFilterBar
        tenants={tenants}
        value={tenantId}
        onChange={handleTenantChange}
      />

      {!tenantId ? (
        <p className="text-sm text-vialto-steel">
          Seleccioná una empresa para ver el inventario.
        </p>
      ) : (
        <StockPanelTenantPage tenantId={tenantId} />
      )}
    </div>
  );
}
