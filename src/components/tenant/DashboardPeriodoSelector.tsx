import { useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  CalendarSearch,
  Check,
  ChevronDown,
  Filter,
  History,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type { useTenantOwnerDashboard } from "@/hooks/useTenantOwnerDashboard";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { modalOverlayClass } from "@/lib/modalLayers";
import type { DashboardPeriodKind } from "@/types/ownerDashboard";

const PERIODOS: { id: DashboardPeriodKind; label: string; icon: LucideIcon }[] = [
  { id: "week", label: "Esta semana", icon: CalendarDays },
  { id: "month", label: "Este mes", icon: CalendarRange },
  { id: "3months", label: "Últimos 3 meses", icon: History },
  { id: "custom", label: "Personalizado", icon: CalendarSearch },
];

const inputFechaClass =
  "h-9 rounded-lg border border-black/15 bg-white px-2.5 text-sm text-vialto-charcoal focus:border-vialto-fire focus:outline-none";

/**
 * Filtro de período del dashboard. Desktop: control segmentado con íconos (va al lado
 * del título). Mobile: botón que abre una hoja con las opciones. `cargando` muestra el
 * spinner en la opción elegida mientras se actualizan los datos.
 */
export function DashboardPeriodoSelector({
  dash,
  cargando,
}: {
  dash: ReturnType<typeof useTenantOwnerDashboard>;
  cargando: boolean;
}) {
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const activo = PERIODOS.find((p) => p.id === dash.period) ?? PERIODOS[1];
  const faltanFechas = dash.period === "custom" && (!dash.customFrom || !dash.customTo);

  useEffect(() => {
    if (!hojaAbierta) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHojaAbierta(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hojaAbierta]);

  useLockBodyScroll(hojaAbierta);

  const iconoDe = (p: (typeof PERIODOS)[number], seleccionado: boolean) =>
    seleccionado && cargando ? (
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-label="Actualizando" />
    ) : (
      <p.icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
    );

  const fechas = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-vialto-steel">
      <label className="flex items-center gap-1.5">
        Desde
        <input
          type="date"
          className={inputFechaClass}
          value={dash.customFrom}
          max={dash.customTo || undefined}
          onChange={(e) => dash.setCustomFrom(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-1.5">
        Hasta
        <input
          type="date"
          className={inputFechaClass}
          value={dash.customTo}
          min={dash.customFrom || undefined}
          onChange={(e) => dash.setCustomTo(e.target.value)}
        />
      </label>
      {faltanFechas && <span>Elegí las dos fechas.</span>}
    </div>
  );

  return (
    <div className="flex flex-col gap-2 lg:items-end">
      {/* Mobile */}
      <button
        type="button"
        onClick={() => setHojaAbierta(true)}
        aria-haspopup="dialog"
        aria-expanded={hojaAbierta}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-left shadow-sm lg:hidden"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-vialto-fire">
          {iconoDe(activo, true)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-vialto-steel">Período</span>
          <span className="block truncate text-sm font-medium text-vialto-charcoal">{activo.label}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-vialto-steel" aria-hidden />
      </button>

      {/* Desktop */}
      <div className="hidden items-center gap-1 rounded-xl border border-black/10 bg-white p-1 shadow-sm lg:flex">
        <span className="flex items-center gap-1.5 px-2.5 text-xs font-medium text-vialto-steel">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          Período
        </span>
        <div role="radiogroup" aria-label="Período del panel" className="flex gap-1">
          {PERIODOS.map((p) => {
            const sel = dash.period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => dash.setPeriod(p.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  sel
                    ? "bg-vialto-charcoal text-white shadow-sm"
                    : "text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
                }`}
              >
                <span className={sel ? "text-vialto-fire" : ""}>{iconoDe(p, sel)}</span>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      {dash.period === "custom" && <div className="hidden lg:block">{fechas}</div>}

      {hojaAbierta && (
        <div className={modalOverlayClass} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-periodo-titulo"
            className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-w-md sm:rounded-lg"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
              <h2 id="dashboard-periodo-titulo" className="text-base font-semibold text-vialto-charcoal">
                Elegir período
              </h2>
              <button
                type="button"
                onClick={() => setHojaAbierta(false)}
                aria-label="Cerrar"
                className="inline-flex h-11 w-11 items-center justify-center text-xl text-vialto-steel hover:bg-vialto-mist"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {PERIODOS.map((p) => {
                const sel = dash.period === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      dash.setPeriod(p.id);
                      if (p.id !== "custom") setHojaAbierta(false);
                    }}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors ${
                      sel ? "bg-vialto-mist font-medium text-vialto-charcoal" : "text-vialto-charcoal hover:bg-vialto-mist/70"
                    }`}
                  >
                    <span className={sel ? "text-vialto-fire" : "text-vialto-steel"}>
                      <p.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="flex-1">{p.label}</span>
                    {sel && <Check className="h-4 w-4 text-vialto-fire" aria-hidden />}
                  </button>
                );
              })}
              {dash.period === "custom" && <div className="border-t border-black/10 px-3 py-4">{fechas}</div>}
            </div>
            <div className="shrink-0 border-t border-black/10 p-4">
              <button
                type="button"
                onClick={() => setHojaAbierta(false)}
                disabled={faltanFechas}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-vialto-charcoal px-4 text-sm font-medium text-white hover:bg-vialto-graphite disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dash.period === "custom" ? "Aplicar" : "Listo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
