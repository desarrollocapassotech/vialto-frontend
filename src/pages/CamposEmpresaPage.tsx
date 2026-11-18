import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";
import { ConfigModulosTab } from "@/components/superadmin/config/ConfigModulosTab";
import {
  Calculator,
  Car,
  FileSpreadsheet,
  LayoutGrid,
  Settings2,
  SlidersHorizontal,
  Store,
  Truck,
  UserCheck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import {
  ConfigSeccionesNav,
  type ConfigNavGrupo,
} from "@/components/superadmin/config/ConfigSeccionesNav";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { ImportTemplatesConfig } from "@/components/importacion/ImportTemplatesConfig";
import { ConfigGeneralTab } from "@/components/superadmin/config/ConfigGeneralTab";
import { CAMPOS_SWITCH_ENTIDAD } from "@/lib/configEntidadesViajes";
import { ConfigViajesSecciones } from "@/components/superadmin/config/ConfigViajesSecciones";
import { ConfigLiquidacionesSecciones } from "@/components/superadmin/config/ConfigLiquidacionesSecciones";
import {
  CamposVisiblesSeccion,
  type Catalogo,
} from "@/components/superadmin/config/CamposVisiblesSeccion";
import {
  ConfigBuscador,
  ConfigBusquedaProvider,
} from "@/components/superadmin/config/ConfigUi";
import { TooltipsDelegados } from "@/components/ui/TooltipsDelegados";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { useTenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { canAccessStock, canAccessViajes } from "@/lib/tenantModules";
import type { Tenant } from "@/types/api";

/**
 * Módulos del catálogo de campos que son módulos vendibles (`Tenant.modules`): se
 * ocultan si la empresa no los contrató. Los demás son entidades del core.
 */
const MODULO_GATE: Record<string, (modules: string[]) => boolean> = {
  viajes: canAccessViajes,
  stock: canAccessStock,
};

const TAB_GENERAL = "__general";
const TAB_MODULOS = "__modulos";
const TAB_TEMPLATES = "__templates";

function modulosDisponibles(
  catalogo: Catalogo | null,
  tenant: Tenant | null,
): string[] {
  if (!catalogo || !tenant) return [];
  return Object.keys(catalogo).filter(
    (m) => MODULO_GATE[m]?.(tenant.modules) ?? true,
  );
}

/** Íconos del menú (los mismos que Base de datos donde coinciden). */
const ICONO_MODULO: Record<string, LucideIcon> = {
  viajes: Truck,
  clientes: Users,
  transportistas: Store,
  choferes: UserCheck,
  vehiculos: Car,
  liquidaciones: Calculator,
  stock: Warehouse,
};

export function CamposEmpresaPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const config = useTenantConfigEmpresa(filtroEmpresa || null);
  const { tenant } = config;

  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [catalogoError, setCatalogoError] = useState<string | null>(null);
  // `?seccion=modulos` abre directo en Módulos contratados (link desde "Editar empresa").
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() =>
    searchParams.get("seccion") === "modulos" ? TAB_MODULOS : TAB_GENERAL,
  );
  const [busqueda, setBusqueda] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Catalogo>(
          "/api/platform/field-config/catalogo",
          () => getToken(),
        );
        if (!cancelled) {
          setCatalogo(data);
          setCatalogoError(null);
        }
      } catch (e) {
        if (!cancelled) setCatalogoError(friendlyError(e, "camposEmpresa"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const modulos = modulosDisponibles(catalogo, tenant);

  // Si la empresa elegida no tiene el módulo de la pestaña activa, vuelve a General.
  useEffect(() => {
    if (!tenant || !catalogo) return;
    if (tab === TAB_GENERAL || tab === TAB_MODULOS || tab === TAB_TEMPLATES)
      return;
    if (!modulosDisponibles(catalogo, tenant).includes(tab))
      setTab(TAB_GENERAL);
  }, [tab, tenant, catalogo]);

  function elegirTab(t: string) {
    setTab(t);
    setBusqueda("");
  }

  const tabLabel =
    tab === TAB_GENERAL
      ? "General"
      : tab === TAB_MODULOS
        ? "Módulos contratados"
        : tab === TAB_TEMPLATES
          ? "Templates de importación"
          : (catalogo?.[tab]?.label ?? "");

  const configConTenant = tenant ? { ...config, tenant } : null;

  const gruposNav: ConfigNavGrupo[] = [
    {
      id: "empresa",
      label: "Empresa",
      items: [
        { id: TAB_GENERAL, label: "General", icon: SlidersHorizontal },
        { id: TAB_MODULOS, label: "Módulos contratados", icon: LayoutGrid },
      ],
    },
    {
      id: "modulos",
      label: "Por módulo",
      items: modulos.map((m) => ({
        id: m,
        label: catalogo?.[m]?.label ?? m,
        icon: ICONO_MODULO[m] ?? Settings2,
      })),
    },
    {
      id: "importacion",
      label: "Importación",
      items: [
        {
          id: TAB_TEMPLATES,
          label: "Templates de importación",
          icon: FileSpreadsheet,
        },
      ],
    },
  ];

  return (
    <div ref={rootRef} className="w-full">
      <TooltipsDelegados contenedorRef={rootRef} />
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Configuración por empresa
      </h1>

      {catalogoError && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {catalogoError}
        </p>
      )}

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={onChangeTenant}
        />
      </div>

      {filtroEmpresa && config.error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {config.error}
        </p>
      )}

      {filtroEmpresa && config.loading && !tenant && (
        <p className="mt-6 text-sm text-vialto-steel">Cargando…</p>
      )}

      {filtroEmpresa && catalogo && configConTenant && (
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <ConfigSeccionesNav
            grupos={gruposNav}
            activo={tab}
            onElegir={elegirTab}
          />

          <div className="min-w-0 flex-1">
            {tab === TAB_TEMPLATES ? (
              <div className="border border-black/10 bg-white p-6">
                <ImportTemplatesConfig
                  tenantId={filtroEmpresa}
                  tenantNombre={configConTenant.tenant.name}
                  tenantModules={configConTenant.tenant.modules}
                  embedded
                />
              </div>
            ) : (
              <div className="max-w-4xl">
                <div className="mb-4">
                  <ConfigBuscador
                    value={busqueda}
                    onChange={setBusqueda}
                    placeholder={`Buscar en ${tabLabel}…`}
                  />
                </div>
                <ConfigBusquedaProvider busqueda={busqueda}>
                  <div className="space-y-4">
                    {tab === TAB_GENERAL ? (
                      <ConfigGeneralTab
                        orgId={filtroEmpresa}
                        config={configConTenant}
                      />
                    ) : tab === TAB_MODULOS ? (
                      <ConfigModulosTab config={configConTenant} />
                    ) : (
                      <>
                        {tab === "viajes" && (
                          <ConfigViajesSecciones
                            orgId={filtroEmpresa}
                            config={configConTenant}
                          />
                        )}
                        {tab === "liquidaciones" && (
                          <ConfigLiquidacionesSecciones
                            config={configConTenant}
                          />
                        )}
                        {catalogo[tab] && (
                          <CamposVisiblesSeccion
                            key={`${filtroEmpresa}:${tab}`}
                            orgId={filtroEmpresa}
                            modulo={tab}
                            catalogoModulo={catalogo[tab]}
                            ocultarCampos={
                              tab === "viajes"
                                ? CAMPOS_SWITCH_ENTIDAD
                                : undefined
                            }
                          />
                        )}
                      </>
                    )}
                  </div>
                </ConfigBusquedaProvider>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
