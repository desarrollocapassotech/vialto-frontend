import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import type { Cliente, Destinatario } from '@/types/api';
import { EgresosStockTenantPage } from './EgresosStockTenantPage';

export function EgresosStockSuperadminPage() {
  const tenants = useTenantsList();
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenantId, setTenantId] = useState(() => searchParams.get('tenantId') ?? '');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesLoading, setClientesLoading] = useState(() => Boolean(searchParams.get('tenantId')));
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
  const [destinatariosLoading, setDestinatariosLoading] = useState(() =>
    Boolean(searchParams.get('tenantId')),
  );

  useEffect(() => {
    const t = searchParams.get('tenantId') ?? '';
    setTenantId(t);
  }, [searchParams]);

  const handleTenantChange = useCallback(
    (v: string) => {
      setTenantId(v);
      if (v) {
        setSearchParams({ tenantId: v });
        setClientes([]);
        setClientesLoading(true);
        setDestinatarios([]);
        setDestinatariosLoading(true);
      } else {
        setSearchParams({});
        setClientes([]);
        setClientesLoading(false);
        setDestinatarios([]);
        setDestinatariosLoading(false);
      }
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!tenantId) {
      setClientes([]);
      setClientesLoading(false);
      setDestinatarios([]);
      setDestinatariosLoading(false);
      return;
    }
    setClientes([]);
    setClientesLoading(true);
    setDestinatarios([]);
    setDestinatariosLoading(true);
    let cancelled = false;
    const q = `tenantId=${encodeURIComponent(tenantId)}`;
    void Promise.all([
      apiJson<Cliente[]>(`/api/platform/clientes?${q}`, () => getToken()),
      apiJson<Destinatario[]>(`/api/platform/destinatarios?${q}`, () => getToken()),
    ])
      .then(([clientesData, destinatariosData]) => {
        if (!cancelled) {
          setClientes(clientesData);
          setDestinatarios(destinatariosData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClientes([]);
          setDestinatarios([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setClientesLoading(false);
          setDestinatariosLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, getToken]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-vialto-charcoal">Egresos / despacho</h1>
        <p className="mt-1 text-sm text-vialto-steel">Registrá egresos de mercadería para cualquier empresa.</p>
      </div>

      <EmpresaFilterBar tenants={tenants} value={tenantId} onChange={handleTenantChange} />

      {!tenantId ? (
        <p className="text-sm text-vialto-steel">Seleccioná una empresa para registrar egresos.</p>
      ) : (
        <EgresosStockTenantPage
          tenantId={tenantId}
          clientesExternos={clientes}
          clientesExternosLoading={clientesLoading}
          destinatariosExternos={destinatarios}
          destinatariosExternosLoading={destinatariosLoading}
        />
      )}
    </div>
  );
}
