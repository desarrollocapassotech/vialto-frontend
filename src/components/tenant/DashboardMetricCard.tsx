import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ChevronRight, CircleCheck, CircleHelp, Gauge, type LucideIcon } from "lucide-react";
import type { MetricCompare } from "@/types/ownerDashboard";
import { formatMoney, formatMoneyUSD } from "@/lib/dashboardFormato";

export type MetricTone = "default" | "positiveCash" | "payable" | "warn";

/** Color del ícono según qué representa el número (cobro, deuda, aviso o neutro). */
const TONO: Record<MetricTone, string> = {
  default: "bg-orange-50 text-vialto-fire",
  positiveCash: "bg-emerald-50 text-emerald-600",
  payable: "bg-rose-50 text-rose-600",
  warn: "bg-amber-50 text-amber-600",
};

/**
 * Tarjeta de un número del dashboard: ícono del tema, nombre, valor grande y una línea
 * chica (comparación con el período anterior, mensaje de "todo en orden" o "Ver detalle").
 */
export function MetricCard({
  title,
  tooltip,
  icon: Icon = Gauge,
  metric,
  simpleCount,
  loading,
  formatValue = formatMoney,
  valueTone = "default",
  linkTo,
  alwaysLink,
  textoCero,
}: {
  title: string;
  tooltip?: string;
  icon?: LucideIcon;
  metric?: MetricCompare;
  /** Conteo simple (viajes, planes, ingresos) en lugar de un monto. */
  simpleCount?: number;
  loading: boolean;
  formatValue?: (n: number) => string;
  valueTone?: MetricTone;
  linkTo?: string;
  /** Link aunque el valor sea cero (por defecto, solo con algo que ver). */
  alwaysLink?: boolean;
  /** Mensaje amigable cuando el valor es cero (ej. "Todo al día"). */
  textoCero?: string;
}) {
  const esConteo = simpleCount !== undefined;
  const ars = metric?.currencies?.ARS ?? metric?.current ?? 0;
  const usd = metric?.currencies?.USD ?? 0;
  const valor = esConteo ? simpleCount : ars + usd;
  const enCero = !loading && valor === 0;
  const conLink = !!linkTo && !loading && (alwaysLink || valor > 0);

  const principal = esConteo
    ? String(Math.round(simpleCount))
    : ars === 0 && usd !== 0
      ? formatMoneyUSD(usd)
      : formatValue(ars);

  const cambio = !esConteo && metric?.changePct != null && metric.previous !== 0 ? metric : null;

  const contenido = (
    <>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lg:h-10 lg:w-10 ${TONO[valueTone]}`}>
          <Icon className="h-[18px] w-[18px] lg:h-5 lg:w-5" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 pt-1 text-sm font-medium leading-snug text-vialto-steel lg:pt-2">
          {title}
        </span>
        {tooltip && (
          <span title={tooltip} className="shrink-0 cursor-help pt-1 text-vialto-steel/40 hover:text-vialto-steel lg:pt-2">
            <CircleHelp className="h-3.5 w-3.5" aria-label={tooltip} />
          </span>
        )}
      </div>

      <div className="mt-auto pt-4">
        {loading ? (
          <span className="block h-9 w-32 animate-pulse rounded-md bg-black/[0.06]" />
        ) : (
          <>
            <p className="break-words font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-vialto-charcoal sm:text-3xl lg:text-4xl">
              {principal}
            </p>
            {!esConteo && ars !== 0 && usd !== 0 && (
              <p className="mt-1.5 font-[family-name:var(--font-display)] text-lg leading-none tracking-wide text-vialto-charcoal/70">
                + {formatMoneyUSD(usd)}
              </p>
            )}
          </>
        )}

        <div className="mt-3 flex min-h-5 items-center justify-between gap-2 text-xs">
          {loading ? (
            <span />
          ) : enCero && textoCero ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden />
              {textoCero}
            </span>
          ) : cambio ? (
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                cambio.sentiment === "positive"
                  ? "text-emerald-600"
                  : cambio.sentiment === "negative"
                    ? "text-rose-600"
                    : "text-vialto-steel"
              }`}
            >
              {cambio.changePct! >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
              )}
              {Math.abs(cambio.changePct!).toFixed(0)}% vs. período anterior
            </span>
          ) : (
            <span />
          )}
          {conLink && (
            <span className="inline-flex shrink-0 items-center text-vialto-steel transition-colors group-hover:text-vialto-fire">
              Ver detalle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </>
  );

  const clase =
    "group flex h-full min-h-[148px] flex-col rounded-xl border border-black/[0.08] bg-white p-4 shadow-sm lg:min-h-[168px] lg:p-5";

  if (conLink) {
    return (
      <Link
        to={linkTo!}
        className={`${clase} transition-all hover:-translate-y-0.5 hover:border-vialto-fire/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-vialto-fire`}
      >
        {contenido}
      </Link>
    );
  }
  return <div className={clase}>{contenido}</div>;
}
