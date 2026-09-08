import { useState } from "react";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { ViajesTenantPage } from "@/pages/ViajesTenantPage";

export function ViajesSuperadminPage() {
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  // Nodo destino del portal de `ViajesTenantPage`: el botón de filtros rápidos (y su panel)
  // solo existe una vez elegida la empresa, así que se teletransporta acá para que quede
  // al lado del título, en vez de en su propia fila más abajo.
  const [filtroSlot, setFiltroSlot] = useState<HTMLDivElement | null>(null);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          Viajes
        </h1>
        <div ref={setFiltroSlot} className="flex flex-wrap items-center gap-4" />
      </div>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={onChangeTenant}
        />
      </div>

      {!filtroEmpresa && (
        <p className="mt-10 text-vialto-steel text-sm">
          Seleccioná una empresa para ver los viajes.
        </p>
      )}

      {filtroEmpresa ? (
        <div className="mt-8">
          <ViajesTenantPage
            tenantId={filtroEmpresa}
            embeddedInSuperadmin
            tenantModules={
              tenants?.find((t) => t.clerkOrgId === filtroEmpresa)?.modules
            }
            filtroRapidoPortalTarget={filtroSlot}
          />
        </div>
      ) : null}
    </div>
  );
}
