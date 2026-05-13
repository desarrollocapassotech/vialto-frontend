import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import type { Cliente } from '@/types/api';
import { IngresosStockTenantPage } from './IngresosStockTenantPage';

export function IngresosStockSuperadminPage() {
  const tenants = useTenantsList();
  const { getToken } = useAuth();
  const [tenantId, setTenantId] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    if (!tenantId) {
      setClientes([]);
      return;
    }
    void apiJson<Cliente[]>(
      `/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`,
      () => getToken(),
    ).then(setClientes).catch(() => setClientes([]));
  }, [tenantId, getToken]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-vialto-charcoal">Ingresos al depósito</h1>
        <p className="mt-1 text-sm text-vialto-steel">
          Registrá ingresos de mercadería para cualquier empresa.
        </p>
      </div>

      <EmpresaFilterBar
        tenants={tenants}
        value={tenantId}
        onChange={(v) => { setTenantId(v); }}
      />

      {!tenantId ? (
        <p className="text-sm text-vialto-steel">Seleccioná una empresa para registrar ingresos.</p>
      ) : (
        <IngresosStockTenantPage tenantId={tenantId} clientesExternos={clientes} />
      )}
    </div>
  );
}
