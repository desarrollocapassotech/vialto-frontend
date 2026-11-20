import { useEffect, useMemo, useState } from "react";
import type { TenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import {
  bloquesEfectivos,
  bloquesParaGuardar,
  ordenVisualDashboard,
  usaBloquesRecomendados,
} from "@/lib/dashboardBloques";
import type { Tenant } from "@/types/api";
import { BloqueVistaPrevia, DashboardEditor } from "@/components/tenant/DashboardEditor";
import { ConfigFila, ConfigSeccion } from "./ConfigUi";
import { Switch } from "./ConfigGeneralTab";

type Props = { config: TenantConfigEmpresa & { tenant: Tenant } };

/**
 * Ficha de la empresa → Dashboard: si la empresa tiene dashboard y qué bloques ve, en
 * qué orden (`Tenant.dashboardBloques`). Mismo editor visual que usa el admin de la
 * empresa en su Inicio (`DashboardEditor`), con vistas previas en vez de datos reales.
 * Sin configuración guardada la empresa ve el set recomendado para sus módulos.
 */
export function ConfigDashboardTab({ config }: Props) {
  const { tenant, guardar, estaGuardando } = config;
  const habilitado = tenant.dashboardHabilitado ?? true;
  const recomendado = usaBloquesRecomendados(tenant);
  const guardados = useMemo(() => ordenVisualDashboard(bloquesEfectivos(tenant)), [tenant]);
  const [orden, setOrden] = useState(guardados);
  const guardando = estaGuardando("dashboardBloques");

  // Al guardar (o si lo cambió el admin de la empresa) se parte de lo guardado.
  useEffect(() => setOrden(guardados), [guardados]);

  const hayCambios =
    orden.length !== guardados.length || orden.some((id, i) => id !== guardados[i]);

  return (
    <>
      <ConfigSeccion titulo="Inicio">
        <ConfigFila
          label="Dashboard (pantalla de inicio)"
          ayuda="Apagado: la empresa entra directo al primer módulo del menú."
        >
          <Switch config={config} campo="dashboardHabilitado" valorDefault label="dashboard" />
        </ConfigFila>
      </ConfigSeccion>

      {habilitado && (
        <ConfigSeccion
          titulo="Bloques del panel"
          barra={
            <p className="text-xs text-vialto-steel">
              {recomendado
                ? "Usa el set recomendado para sus módulos. Cualquier cambio lo vuelve propio de la empresa."
                : "Configuración propia de la empresa."}{" "}
              El admin de la empresa también lo puede personalizar desde su Inicio.
            </p>
          }
        >
          <div className="p-4">
            {guardados.length === 0 && orden.length === 0 ? (
              <p className="text-sm text-vialto-steel">
                Ningún módulo contratado tiene bloques de dashboard.
              </p>
            ) : (
              <DashboardEditor
                tenant={tenant}
                orden={orden}
                onOrden={setOrden}
                renderBloque={(id) => <BloqueVistaPrevia id={id} />}
                onGuardar={() => void guardar({ dashboardBloques: bloquesParaGuardar(tenant, orden) })}
                onCancelar={hayCambios ? () => setOrden(guardados) : undefined}
                guardando={guardando}
                hayCambios={hayCambios}
              />
            )}
          </div>
        </ConfigSeccion>
      )}
    </>
  );
}
