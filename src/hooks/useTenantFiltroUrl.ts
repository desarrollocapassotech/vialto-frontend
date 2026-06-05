import { useSearchParams } from 'react-router-dom';

export function useTenantFiltroUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroEmpresa = searchParams.get('tenantId')?.trim() ?? '';

  function onChangeTenant(nextTenantId: string) {
    const next = new URLSearchParams(searchParams);
    if (nextTenantId) next.set('tenantId', nextTenantId);
    else next.delete('tenantId');
    setSearchParams(next, { replace: true });
  }

  return { filtroEmpresa, onChangeTenant };
}