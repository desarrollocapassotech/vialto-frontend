import { useEffect } from "react";
import { Eye } from "lucide-react";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { useTenantsList } from "@/hooks/useTenantsList";
import { setTenantLecturaCc } from "@/lib/cuentaCorriente";
import { pageTitleClass } from "@/lib/listadoTabla";
import { CuentaCorrienteTenantPage } from "@/pages/CuentaCorrienteTenantPage";

/**
 * Cuenta corriente para superadmin: elige la empresa y ve su cuenta corriente en SOLO
 * LECTURA (saldos, movimientos, detalle, adjuntos, orden de pago y exportar). No se carga,
 * imputa ni elimina nada en nombre de la empresa (decisión de nov 2026).
 */
export function CuentaCorrienteSuperadminPage() {
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const empresa = tenants?.find((t) => t.clerkOrgId === filtroEmpresa) ?? null;

  // Se fija en el render (no en un efecto): los efectos de los hijos, que piden los datos,
  // corren antes que los del padre y tienen que salir ya con la empresa elegida.
  setTenantLecturaCc(filtroEmpresa || null);
  useEffect(() => () => setTenantLecturaCc(null), []);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className={pageTitleClass}>Cuenta corriente</h1>
        {filtroEmpresa && (
          <span className="inline-flex items-center gap-1.5 rounded border border-black/10 bg-white px-2 py-0.5 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.14em] text-vialto-steel">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Solo lectura
          </span>
        )}
      </div>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={onChangeTenant}
        />
      </div>

      {filtroEmpresa && empresa && (
        <div className="mt-8">
          <CuentaCorrienteTenantPage
            key={filtroEmpresa}
            tenantId={filtroEmpresa}
            modulosEmpresa={empresa.modules}
            soloLectura
          />
        </div>
      )}
    </div>
  );
}
