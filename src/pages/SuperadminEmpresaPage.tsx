import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  Building2,
  Calculator,
  Car,
  FileSpreadsheet,
  LayoutGrid,
  Settings2,
  SlidersHorizontal,
  Store,
  Truck,
  Upload,
  UserCheck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { ImportTemplatesConfig } from "@/components/importacion/ImportTemplatesConfig";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import {
  CamposVisiblesSeccion,
  type Catalogo,
} from "@/components/superadmin/config/CamposVisiblesSeccion";
import { ConfigDatosTab } from "@/components/superadmin/config/ConfigDatosTab";
import { ConfigGeneralTab } from "@/components/superadmin/config/ConfigGeneralTab";
import { ConfigLiquidacionesSecciones } from "@/components/superadmin/config/ConfigLiquidacionesSecciones";
import { ConfigModulosTab } from "@/components/superadmin/config/ConfigModulosTab";
import {
  ConfigSeccionesNav,
  type ConfigNavGrupo,
} from "@/components/superadmin/config/ConfigSeccionesNav";
import {
  ConfigBuscador,
  ConfigBusquedaProvider,
} from "@/components/superadmin/config/ConfigUi";
import { ConfigViajesSecciones } from "@/components/superadmin/config/ConfigViajesSecciones";
import { TooltipsDelegados } from "@/components/ui/TooltipsDelegados";
import { useBreadcrumbOverride } from "@/hooks/useBreadcrumbOverride";
import { useTenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import { apiJson } from "@/lib/api";
import { CAMPOS_SWITCH_ENTIDAD } from "@/lib/configEntidadesViajes";
import { friendlyError } from "@/lib/friendlyError";
import { labelBillingStatus } from "@/lib/platformLabels";
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

/** Secciones fijas; el resto de `?seccion=` son módulos del catálogo de campos. */
const SECCION_DATOS = "datos";
const SECCION_GENERAL = "general";
const SECCION_MODULOS = "modulos";
const SECCION_TEMPLATES = "templates";
const SECCIONES_FIJAS: Record<string, string> = {
  [SECCION_DATOS]: "Datos y suscripción",
  [SECCION_GENERAL]: "General",
  [SECCION_MODULOS]: "Módulos contratados",
  [SECCION_TEMPLATES]: "Templates de importación",
};

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

function modulosDisponibles(
  catalogo: Catalogo | null,
  tenant: Tenant | null,
): string[] {
  if (!catalogo || !tenant) return [];
  return Object.keys(catalogo).filter(
    (m) => MODULO_GATE[m]?.(tenant.modules) ?? true,
  );
}

/**
 * Ficha de una empresa (superadmin): datos, suscripción, módulos contratados y toda
 * la configuración por empresa (antes eran "Editar empresa" y "Configuración por
 * empresa", dos pantallas separadas). La sección activa va en `?seccion=`.
 */
export function SuperadminEmpresaPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const config = useTenantConfigEmpresa(orgId || null);
  const { tenant } = config;
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [catalogoError, setCatalogoError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useBreadcrumbOverride(
    tenant
      ? [
          { label: "Panorama", to: "/" },
          { label: "Empresas", to: "/superadmin/empresas" },
          { label: tenant.name },
        ]
      : null,
  );

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
  const pedida = searchParams.get("seccion") ?? SECCION_DATOS;
  // Una sección de módulo que la empresa no tiene (o un link viejo) cae en Datos.
  const seccion =
    pedida in SECCIONES_FIJAS ||
    !catalogo ||
    !tenant ||
    modulos.includes(pedida)
      ? pedida
      : SECCION_DATOS;

  function elegirSeccion(s: string) {
    const next = new URLSearchParams(searchParams);
    next.set("seccion", s);
    setSearchParams(next, { replace: true });
    setBusqueda("");
  }

  const seccionLabel =
    SECCIONES_FIJAS[seccion] ?? catalogo?.[seccion]?.label ?? "";
  const configConTenant = tenant ? { ...config, tenant } : null;

  const gruposNav: ConfigNavGrupo[] = [
    {
      id: "empresa",
      label: "Empresa",
      items: [
        {
          id: SECCION_DATOS,
          label: SECCIONES_FIJAS[SECCION_DATOS],
          icon: Building2,
        },
        {
          id: SECCION_GENERAL,
          label: SECCIONES_FIJAS[SECCION_GENERAL],
          icon: SlidersHorizontal,
        },
        {
          id: SECCION_MODULOS,
          label: SECCIONES_FIJAS[SECCION_MODULOS],
          icon: LayoutGrid,
        },
      ],
    },
    {
      id: "por-modulo",
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
          id: SECCION_TEMPLATES,
          label: SECCIONES_FIJAS[SECCION_TEMPLATES],
          icon: FileSpreadsheet,
        },
      ],
    },
  ];

  if (!orgId) return <Navigate to="/superadmin/empresas" replace />;

  return (
    <SuperadminOnly>
      <div ref={rootRef} className="w-full">
        <TooltipsDelegados contenedorRef={rootRef} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="min-w-0 font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal md:text-5xl">
            {tenant?.name ?? "Empresa"}
          </h1>
          {tenant && (
            <span className="rounded border border-black/10 bg-white px-2 py-0.5 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.14em] text-vialto-steel">
              {labelBillingStatus(tenant.billingStatus)}
            </span>
          )}
          <div className="ml-auto">
            <Link
              to={`/superadmin/empresas/${encodeURIComponent(orgId)}/importar`}
              className="inline-flex h-10 items-center gap-2 border border-black/20 bg-white px-4 text-sm uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Importar datos
            </Link>
          </div>
        </div>

        {(catalogoError || config.error) && (
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {config.error ?? catalogoError}
          </p>
        )}

        {config.loading && !tenant && (
          <p className="mt-6 text-sm text-vialto-steel">Cargando…</p>
        )}

        {catalogo && configConTenant && (
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <ConfigSeccionesNav
              grupos={gruposNav}
              activo={seccion}
              onElegir={elegirSeccion}
            />

            <div className="min-w-0 flex-1">
              {seccion === SECCION_TEMPLATES ? (
                <div className="border border-black/10 bg-white p-6">
                  <ImportTemplatesConfig
                    tenantId={orgId}
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
                      placeholder={`Buscar en ${seccionLabel}…`}
                    />
                  </div>
                  <ConfigBusquedaProvider busqueda={busqueda}>
                    <div className="space-y-4">
                      {seccion === SECCION_DATOS && (
                        <ConfigDatosTab
                          orgId={orgId}
                          config={configConTenant}
                        />
                      )}
                      {seccion === SECCION_GENERAL && (
                        <ConfigGeneralTab
                          orgId={orgId}
                          config={configConTenant}
                        />
                      )}
                      {seccion === SECCION_MODULOS && (
                        <ConfigModulosTab config={configConTenant} />
                      )}
                      {seccion === "viajes" && (
                        <ConfigViajesSecciones
                          orgId={orgId}
                          config={configConTenant}
                        />
                      )}
                      {seccion === "liquidaciones" && (
                        <ConfigLiquidacionesSecciones
                          config={configConTenant}
                        />
                      )}
                      {!(seccion in SECCIONES_FIJAS) && catalogo[seccion] && (
                        <CamposVisiblesSeccion
                          key={`${orgId}:${seccion}`}
                          orgId={orgId}
                          modulo={seccion}
                          catalogoModulo={catalogo[seccion]}
                          ocultarCampos={
                            seccion === "viajes"
                              ? CAMPOS_SWITCH_ENTIDAD
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </ConfigBusquedaProvider>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SuperadminOnly>
  );
}

/**
 * Links viejos: `/superadmin/campos-empresa?tenantId=…` (Configuración por empresa)
 * y `/superadmin/empresas/:orgId/editar` (Editar empresa) → ficha de la empresa.
 */
export function RedirectConfiguracionEmpresa() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim();
  const seccion = searchParams.get("seccion") ?? SECCION_GENERAL;
  return (
    <Navigate
      to={
        tenantId
          ? `/superadmin/empresas/${encodeURIComponent(tenantId)}?seccion=${seccion}`
          : "/superadmin/empresas"
      }
      replace
    />
  );
}

export function RedirectEditarEmpresa() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  return (
    <Navigate
      to={`/superadmin/empresas/${encodeURIComponent(orgId)}?seccion=${SECCION_DATOS}`}
      replace
    />
  );
}
