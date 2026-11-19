import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CargandoVialto } from "@/components/shared/CargandoVialto";
import type { useTenantOwnerDashboard } from "@/hooks/useTenantOwnerDashboard";
import { useMantenimientoDashboard } from "@/hooks/useMantenimientoDashboard";
import {
  useCombustibleDashboard,
  useFinancieroDashboard,
  useTableroCuentaCorriente,
} from "@/hooks/useDashboardFuentes";
import {
  bloqueDashboard,
  bloquesEfectivos,
  filasDashboard,
  fuentesDeBloques,
  tarjetaDosMonedas,
} from "@/lib/dashboardBloques";
import { frasePeriodo, periodoAFechas } from "@/lib/dashboardPeriodo";
import type { Tenant } from "@/types/api";
import { DashboardPeriodoSelector } from "./DashboardPeriodoSelector";
import { DashboardBloque, type DashboardDatos } from "./DashboardBloque";

/**
 * Links que abrían una pestaña del viejo dashboard (hoy los usan las notificaciones).
 * Si la empresa no tiene ese bloque elegido, se muestra igual mientras se mira.
 */
const DEEP_LINKS: Record<string, { valor: string; bloque: string }> = {
  combustibleTab: { valor: "alertas", bloque: "pendientes-combustible" },
  financieroTab: { valor: "alertas", bloque: "pendientes-margen-bajo" },
};

/** Columnas que ocupa cada bloque en desktop (de las 4 de la grilla), según `filasDashboard`. */
const SPAN_DESKTOP: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
};

interface TenantOwnerDashboardProps {
  /** Título de la página ("Panel de …"); va a la izquierda del filtro de período. */
  titulo: string;
  tenantId: string;
  tenant: Tenant;
  dash: ReturnType<typeof useTenantOwnerDashboard>;
  onViewViaje?: (id: string) => void;
  loadingViajeId?: string | null;
  onViewFactura?: (id: string) => void;
  loadingFacturaId?: string | null;
}

/**
 * Dashboard de inicio de la empresa: una sola página con los bloques que eligió el
 * superadmin (`Tenant.dashboardBloques`, ver `lib/dashboardBloques.ts`), sin pestañas.
 * Cada fuente de datos se pide solo si algún bloque la usa.
 */
export function TenantOwnerDashboard({
  titulo,
  tenantId,
  tenant,
  dash,
  onViewViaje,
  loadingViajeId,
  onViewFactura,
  loadingFacturaId,
}: TenantOwnerDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [forzado, setForzado] = useState<string | null>(null);

  useEffect(() => {
    for (const [param, { valor, bloque }] of Object.entries(DEEP_LINKS)) {
      if (searchParams.get(param) !== valor) continue;
      if (bloqueDashboard(bloque)?.disponible(tenant)) setForzado(bloque);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(param);
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams, tenant]);

  const ids = useMemo(() => {
    const base = bloquesEfectivos(tenant);
    return forzado && !base.includes(forzado) ? [...base, forzado] : base;
  }, [tenant, forzado]);

  useEffect(() => {
    if (!forzado) return;
    document
      .getElementById(`bloque-${forzado}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [forzado]);

  const fuentes = fuentesDeBloques(ids);
  const rango = periodoAFechas(dash.period, dash.customFrom, dash.customTo);
  const datos: DashboardDatos = {
    tenantId,
    dash,
    rango,
    financiero: useFinancieroDashboard(fuentes.has("financiero"), rango),
    combustible: useCombustibleDashboard(
      fuentes.has("combustible"),
      rango,
      ids.includes("pendientes-combustible"),
    ),
    cuentaCorriente: useTableroCuentaCorriente(fuentes.has("cuentaCorriente"), rango),
    mantenimiento: useMantenimientoDashboard(fuentes.has("mantenimiento")),
    onViewViaje,
    loadingViajeId,
    onViewFactura,
    loadingFacturaId,
  };

  // Cambio de período: spinner en el filtro + bloques atenuados hasta que llegan los datos.
  const cargando =
    dash.loading ||
    datos.financiero.loading ||
    datos.combustible.loading ||
    datos.cuentaCorriente.loading;

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-vialto-charcoal sm:text-4xl md:text-5xl">
          {titulo}
        </h1>
        <DashboardPeriodoSelector dash={dash} cargando={cargando} />
      </div>

      {dash.error && (
        <div
          className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {dash.error}
        </div>
      )}

      {ids.length === 0 && (
        <p className="text-sm text-vialto-steel">
          Todavía no hay indicadores para los módulos de tu empresa.
        </p>
      )}

      {/* Cambio de período: toda la pantalla queda bloqueada bajo un difuminado blanco,
          dejando ver detrás los skeletons de las tarjetas, con el camión en el centro. */}
      {cargando && (
        <CargandoVialto
          variante="pantalla"
          mensaje={`Actualizando el panel ${frasePeriodo(dash.period, dash.customFrom, dash.customTo)}…`}
        />
      )}

      {/* Una sola grilla: en desktop, filas de 4 columnas armadas por `filasDashboard`
          (tarjeta 1, pendientes 2, tablas anchas 4, sin huecos). En mobile, 2 columnas:
          tarjetas de a dos (las de pesos + dólares a todo el ancho) y el resto entero. */}
      <div aria-busy={cargando} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {filasDashboard(ids)
          .flat()
          .map(({ id, span }) => {
            const tarjeta = bloqueDashboard(id)?.tipo === "tarjeta";
            const mobile = tarjeta && !tarjetaDosMonedas(id) ? "col-span-1" : "col-span-2";
            return (
              // `[&>*]:h-full`: el bloque se estira al alto de su fila (tarjeta y pendiente parejos).
              <div
                key={id}
                id={`bloque-${id}`}
                className={`min-w-0 scroll-mt-24 [&>*]:h-full ${mobile} ${SPAN_DESKTOP[span]}`}
              >
                <DashboardBloque id={id} datos={datos} />
              </div>
            );
          })}
      </div>
    </div>
  );
}
