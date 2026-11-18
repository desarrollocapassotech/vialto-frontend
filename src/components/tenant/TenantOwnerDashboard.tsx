import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { VialtoTruckLoader } from "@/components/shared/VialtoTruckLoader";
import type { useTenantOwnerDashboard } from "@/hooks/useTenantOwnerDashboard";
import { useMantenimientoDashboard } from "@/hooks/useMantenimientoDashboard";
import {
  useCombustibleDashboard,
  useFinancieroDashboard,
  useTableroCuentaCorriente,
} from "@/hooks/useDashboardFuentes";
import {
  bloqueAnchoCompleto,
  bloqueDashboard,
  bloquesEfectivos,
  fuentesDeBloques,
  tarjetaDosMonedas,
  tarjetasPorFila,
} from "@/lib/dashboardBloques";
import { periodoAFechas } from "@/lib/dashboardPeriodo";
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

/** Ancho de cada tarjeta en desktop según cuántas van por fila (`tarjetasPorFila`). */
const BASIS_DESKTOP: Record<number, string> = {
  1: "lg:basis-full",
  2: "lg:basis-[calc(50%-0.25rem)]",
  3: "lg:basis-[calc(33.333%-0.34rem)]",
  4: "lg:basis-[calc(25%-0.375rem)]",
};

/**
 * Pendientes/análisis van de a dos por fila. Ocupa la fila entera si es ancho, o si
 * queda sin compañero (el anterior lo dejó solo y el siguiente es ancho o no hay).
 */
function ocupaFilaEntera(ids: string[], i: number): boolean {
  if (bloqueAnchoCompleto(ids[i])) return true;
  // Posición dentro de la tanda de bloques angostos seguidos.
  let inicio = i;
  while (inicio > 0 && !bloqueAnchoCompleto(ids[inicio - 1])) inicio--;
  let fin = i;
  while (fin < ids.length - 1 && !bloqueAnchoCompleto(ids[fin + 1])) fin++;
  const tanda = fin - inicio + 1;
  return tanda % 2 === 1 && i === fin;
}

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

  // Tarjetas seguidas van en una grilla de tarjetas; el resto, de a dos (o a todo el ancho).
  const grupos: { tarjetas: boolean; ids: string[] }[] = [];
  for (const id of ids) {
    const tarjetas = bloqueDashboard(id)?.tipo === "tarjeta";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.tarjetas === tarjetas) ultimo.ids.push(id);
    else grupos.push({ tarjetas, ids: [id] });
  }

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
      {cargando &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-[60] flex animate-[fadeIn_150ms_ease-out] flex-col items-center justify-center gap-2 bg-white/55 backdrop-blur-[3px]"
          >
            <VialtoTruckLoader className="h-48 w-auto drop-shadow-sm" label="Actualizando datos" />
            <span className="text-sm font-medium text-vialto-steel">Actualizando datos…</span>
          </div>,
          document.body,
        )}

      <div aria-busy={cargando}>
        <div className="space-y-6 lg:space-y-8">
          {grupos.map((g, i) => (
            <Fragment key={`${i}-${g.ids[0]}`}>
              {g.tarjetas ? (
                // Flex con crecimiento: cada fila se completa siempre (una tarjeta sola
                // en la última fila se estira en vez de dejar hueco).
                <div className="flex flex-wrap gap-2">
                  {g.ids.map((id) => (
                    <div
                      key={id}
                      className={`min-w-0 grow ${
                        tarjetaDosMonedas(id) ? "basis-full" : "basis-[calc(50%-0.25rem)]"
                      } ${BASIS_DESKTOP[tarjetasPorFila(g.ids.length)]}`}
                    >
                      <DashboardBloque id={id} datos={datos} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {g.ids.map((id, j) => (
                    <div
                      key={id}
                      id={`bloque-${id}`}
                      className={`min-w-0 scroll-mt-24 ${
                        ocupaFilaEntera(g.ids, j) ? "lg:col-span-2" : ""
                      }`}
                    >
                      <DashboardBloque id={id} datos={datos} />
                    </div>
                  ))}
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
