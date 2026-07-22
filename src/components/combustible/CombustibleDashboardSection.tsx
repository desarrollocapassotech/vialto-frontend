import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiJson } from "@/lib/api";
import type { useTenantOwnerDashboard } from "@/hooks/useTenantOwnerDashboard";
import type { CombustibleDashboardResponse } from "@/types/combustibleDashboard";
import {
  ResumenPanel,
  VehiculoRankingTable,
  ChoferRankingTable,
  DistribucionPanel,
  AlertasList,
  ViajesCruceTable,
  fmtFormaPagoClave,
} from "./CombustibleDashboardPanels";

type CombustibleTab = "resumen" | "vehiculo" | "chofer" | "distribucion" | "alertas" | "viajes";

function periodToDates(
  period: string,
  customFrom: string,
  customTo: string,
): { from: string; to: string } | null {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (period === "week") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: todayStr };
  }
  if (period === "month") {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
      to: todayStr,
    };
  }
  if (period === "3months") {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 3);
    return { from: d.toISOString().slice(0, 10), to: todayStr };
  }
  if (period === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  return null;
}

export function CombustibleDashboardSection({
  dash,
  showViajes,
}: {
  dash: ReturnType<typeof useTenantOwnerDashboard>;
  showViajes: boolean;
}) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [data, setData] = useState<CombustibleDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<CombustibleTab>("resumen");
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link desde el panel de Alertas (ej. "Ir a alertas de combustible →"):
  // `/?combustibleTab=alertas` salta directo a esta pestaña y hace scroll a la sección.
  useEffect(() => {
    if (searchParams.get("combustibleTab") !== "alertas") return;
    setTab("alertas");
    document
      .getElementById("combustible-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("combustibleTab");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const dates = periodToDates(dash.period, dash.customFrom, dash.customTo);
    if (!dates) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const qs = new URLSearchParams({ from: dates.from, to: dates.to });
        const res = await apiJson<CombustibleDashboardResponse>(
          `/api/combustible/dashboard?${qs.toString()}`,
          () => getTokenRef.current(),
        );
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dash.period, dash.customFrom, dash.customTo]);

  const cantAlertas = data?.alertas.length ?? 0;
  const periodo = periodToDates(dash.period, dash.customFrom, dash.customTo);

  const tabs: { id: CombustibleTab; label: string; badge?: number }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "vehiculo", label: "Por vehículo" },
    { id: "chofer", label: "Por chofer" },
    { id: "distribucion", label: "Distribución" },
    { id: "alertas", label: "Alertas", badge: cantAlertas > 0 ? cantAlertas : undefined },
    ...(showViajes ? [{ id: "viajes" as const, label: "Viajes" }] : []),
  ];

  return (
    <section id="combustible-heading" aria-label="Combustible">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vista de combustible">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-[family-name:var(--font-ui)] uppercase tracking-wider transition-colors ${
              tab === t.id
                ? "border-vialto-fire bg-vialto-charcoal text-vialto-fire"
                : "border-vialto-steel/40 bg-white text-vialto-steel hover:border-vialto-fire/50"
            }`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-vialto-fire px-1 text-[10px] font-semibold leading-none text-white"
                aria-hidden
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "resumen" && <ResumenPanel data={data} loading={loading} />}
        {tab === "vehiculo" && (
          <VehiculoRankingTable items={data?.porVehiculo ?? []} periodo={periodo} />
        )}
        {tab === "chofer" && (
          <ChoferRankingTable items={data?.porChofer ?? []} periodo={periodo} />
        )}
        {tab === "distribucion" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <DistribucionPanel
              titulo="Distribución por estación"
              items={data?.distribucionEstaciones ?? []}
              labelFor={(clave) => clave}
            />
            <DistribucionPanel
              titulo="Distribución por forma de pago"
              items={data?.distribucionFormaPago ?? []}
              labelFor={fmtFormaPagoClave}
            />
          </div>
        )}
        {tab === "alertas" && <AlertasList alertas={data?.alertas ?? []} />}
        {tab === "viajes" && showViajes && <ViajesCruceTable items={data?.viajesCruce ?? []} />}
      </div>
    </section>
  );
}
