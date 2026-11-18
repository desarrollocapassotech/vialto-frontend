import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { useTenantsList } from "@/hooks/useTenantsList";
import { apiJson } from "@/lib/api";
import { pageTitleClass } from "@/lib/listadoTabla";
import type { Cliente } from "@/types/api";
import { DivisionesStockTenantPage } from "./DivisionesStockTenantPage";

/** División de bultos para superadmin: elige la empresa y registra la división en ella. */
export function DivisionesStockSuperadminPage() {
  const tenants = useTenantsList();
  const { getToken } = useAuth();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);

  useEffect(() => {
    setClientes([]);
    if (!filtroEmpresa) {
      setClientesLoading(false);
      return;
    }
    let cancelado = false;
    setClientesLoading(true);
    apiJson<Cliente[]>(
      `/api/platform/clientes?tenantId=${encodeURIComponent(filtroEmpresa)}`,
      () => getToken(),
    )
      .then((data) => {
        if (!cancelado) setClientes(data);
      })
      .catch(() => {
        if (!cancelado) setClientes([]);
      })
      .finally(() => {
        if (!cancelado) setClientesLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [filtroEmpresa, getToken]);

  return (
    <div className="space-y-6">
      {/* Con empresa elegida, el título lo pone la pantalla de división. */}
      {!filtroEmpresa && <h1 className={pageTitleClass}>División de bultos</h1>}
      <EmpresaFilterBar
        tenants={tenants}
        value={filtroEmpresa}
        onChange={onChangeTenant}
      />

      {filtroEmpresa && (
        <DivisionesStockTenantPage
          key={filtroEmpresa}
          tenantId={filtroEmpresa}
          clientesExternos={clientes}
          clientesExternosLoading={clientesLoading}
        />
      )}
    </div>
  );
}
