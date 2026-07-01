import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { StockMovimientosTenantPage } from "./StockMovimientosTenantPage";

export function StockMovimientosSuperadminPage() {
  const tenants = useTenantsList();
  const [searchParams, setSearchParams] = useSearchParams();
  const tidFromUrl = searchParams.get("tenantId") ?? "";
  const [tenantId, setTenantId] = useState(tidFromUrl);

  useEffect(() => {
    const t = searchParams.get("tenantId") ?? "";
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
        <h1 className="text-2xl font-semibold text-vialto-charcoal">
          Movimientos
        </h1>
        <p className="mt-1 text-sm text-vialto-steel">
          Ingresos y egresos de la empresa seleccionada, por fecha de movimiento
          (más reciente primero).
        </p>
      </div>

      <EmpresaFilterBar
        tenants={tenants}
        value={tenantId}
        onChange={handleTenantChange}
      />

      {!tenantId ? (
        <p className="text-sm text-vialto-steel">
          Seleccioná una empresa para ver los movimientos.
        </p>
      ) : (
        <StockMovimientosTenantPage tenantId={tenantId} />
      )}
    </div>
  );
}
