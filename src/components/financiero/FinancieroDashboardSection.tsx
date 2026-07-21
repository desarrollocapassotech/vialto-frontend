import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import type { useTenantOwnerDashboard } from "@/hooks/useTenantOwnerDashboard";
import type { FinancieroDashboardResponse } from "@/types/financieroDashboard";
import {
  MargenResumenPanel,
  MargenPorClienteTable,
  MargenPorTransportistaTable,
  MargenPorRutaTable,
  MargenAlertasList,
  ViajesFunnelPanel,
  LiquidacionesPanel,
  FacturacionPanel,
  CashflowPanel,
} from "./FinancieroDashboardPanels";

type FinancieroTab = "margen" | "viajes" | "liquidaciones" | "facturacion" | "cashflow";

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

export function FinancieroDashboardSection({
  dash,
  showViajes,
  showFacturacion,
  showIntegracionArca,
}: {
  dash: ReturnType<typeof useTenantOwnerDashboard>;
  showViajes: boolean;
  showFacturacion: boolean;
  showIntegracionArca: boolean;
}) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [data, setData] = useState<FinancieroDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const tabs: { id: FinancieroTab; label: string; badge?: number }[] = [
    ...(showViajes ? [{ id: "margen" as const, label: "Margen" }] : []),
    ...(showViajes ? [{ id: "viajes" as const, label: "Viajes" }] : []),
    ...(showViajes && showIntegracionArca
      ? [{ id: "liquidaciones" as const, label: "Liquidaciones" }]
      : []),
    ...(showFacturacion ? [{ id: "facturacion" as const, label: "Facturación" }] : []),
    ...(showViajes && showFacturacion ? [{ id: "cashflow" as const, label: "Cashflow" }] : []),
  ];
  const [tab, setTab] = useState<FinancieroTab | null>(null);
  const tabActivo = tab ?? tabs[0]?.id ?? "margen";

  useEffect(() => {
    const dates = periodToDates(dash.period, dash.customFrom, dash.customTo);
    if (!dates) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const qs = new URLSearchParams({ from: dates.from, to: dates.to });
        const res = await apiJson<FinancieroDashboardResponse>(
          `/api/dashboard/financiero?${qs.toString()}`,
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

  if (tabs.length === 0) return null;

  return (
    <section aria-labelledby="financiero-heading">
      <h2
        id="financiero-heading"
        className="mb-2 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-steel lg:mb-3"
      >
        Financiero
      </h2>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vista financiera">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tabActivo === t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-[family-name:var(--font-ui)] uppercase tracking-wider transition-colors ${
              tabActivo === t.id
                ? "border-vialto-fire bg-vialto-charcoal text-vialto-fire"
                : "border-vialto-steel/40 bg-white text-vialto-steel hover:border-vialto-fire/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tabActivo === "margen" && (
          <div className="flex flex-col gap-4">
            <MargenResumenPanel data={data} loading={loading} />
            <div>
              <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
                Alertas de margen bajo o negativo
              </p>
              <MargenAlertasList alertas={data?.margen?.alertas ?? []} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
                  Por cliente
                </p>
                <MargenPorClienteTable items={data?.margen?.porCliente ?? []} />
              </div>
              <div>
                <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
                  Por transportista
                </p>
                <MargenPorTransportistaTable items={data?.margen?.porTransportista ?? []} />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
                  Por ruta
                </p>
                <MargenPorRutaTable items={data?.margen?.porRuta ?? []} columnaClave="Ruta" />
              </div>
              <div>
                <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
                  Por tipo de carga
                </p>
                <MargenPorRutaTable items={data?.margen?.porTipoCarga ?? []} columnaClave="Tipo de carga" />
              </div>
            </div>
          </div>
        )}
        {tabActivo === "viajes" && <ViajesFunnelPanel data={data} loading={loading} />}
        {tabActivo === "liquidaciones" && <LiquidacionesPanel data={data} loading={loading} />}
        {tabActivo === "facturacion" && <FacturacionPanel data={data} loading={loading} />}
        {tabActivo === "cashflow" && <CashflowPanel data={data} loading={loading} />}
      </div>
    </section>
  );
}
