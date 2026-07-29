import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtTipoVehiculo, fmtFormaPago } from "@/lib/combustibleLabels";
import { CargaCombustibleViewModal } from "./CargaCombustibleViewModal";
import { motivoShortLabel } from "./SospechaBadge";
import type {
  CombustibleAlerta,
  CombustibleDashboardResponse,
  CombustibleDistribucionItem,
  CombustiblePorChoferItem,
  CombustiblePorVehiculoItem,
  CombustibleEvolucionPrecioPunto,
  CombustibleEvolucionCostoPorKmPunto,
  CombustibleViajesCruceItem,
} from "@/types/combustibleDashboard";

function fmtMoney(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtLitros(n: number): string {
  return `${Math.round(n).toLocaleString("es-AR")} L`;
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("es-AR");
}

function fmtFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function SemaforoDot({ color }: { color: "verde" | "amarillo" | "rojo" }) {
  const cls =
    color === "rojo"
      ? "bg-rose-500"
      : color === "amarillo"
        ? "bg-amber-400"
        : "bg-emerald-500";
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`}
      aria-hidden
    />
  );
}

function TrendBadge({ changePct }: { changePct: number | null | undefined }) {
  if (changePct === null || changePct === undefined) return null;
  if (changePct === 0) {
    return (
      <span className="text-[11px] text-white/40">
        Sin cambios vs. período anterior
      </span>
    );
  }
  const subio = changePct > 0;
  const Icon = subio ? TrendingUp : TrendingDown;
  const colorClass = subio ? "text-rose-400" : "text-emerald-400";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] ${colorClass}`}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      {subio ? "+" : ""}
      {changePct.toFixed(1)}% vs. período anterior
    </span>
  );
}

function StatTile({
  label,
  value,
  trend,
  linkTo,
}: {
  label: string;
  value: string;
  trend?: number | null;
  linkTo?: string;
}) {
  const inner = (
    <>
      <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
        {label}
      </span>
      <div>
        <span className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-white">
          {value}
        </span>
        {trend !== undefined && (
          <div className="mt-1">
            <TrendBadge changePct={trend} />
          </div>
        )}
        {linkTo && (
          <span className="mt-1 flex justify-end font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-white/40 transition-colors group-hover:text-white/80">
            Ver →
          </span>
        )}
      </div>
    </>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="group flex min-h-[110px] flex-col justify-between bg-vialto-graphite p-5 transition-colors hover:bg-vialto-charcoal"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex min-h-[110px] flex-col justify-between bg-vialto-graphite p-5">
      {inner}
    </div>
  );
}

// ── Resumen ──────────────────────────────────────────────────────────────

export function ResumenPanel({
  data,
  loading,
}: {
  data: CombustibleDashboardResponse | null;
  loading: boolean;
}) {
  const listo = !loading && data !== null;
  const [metricaChart, setMetricaChart] = useState<"km" | "litro">("km");

  const vehiculosConKm = (data?.porVehiculo ?? []).filter(
    (v) => v.kmRecorridos != null && v.kmRecorridos > 0,
  );
  const totalKmFlota = vehiculosConKm.reduce(
    (s, v) => s + (v.kmRecorridos ?? 0),
    0,
  );
  const totalMontoConKm = vehiculosConKm.reduce((s, v) => s + v.monto, 0);
  const precioPromedioPorKm =
    totalKmFlota > 0 ? totalMontoConKm / totalKmFlota : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatTile
          label="Cargas"
          value={listo ? String(data.totalCargas) : "—"}
          linkTo={listo ? "/combustible" : undefined}
        />
        <StatTile
          label="Costo prom. / km"
          value={
            listo && totalKmFlota > 0 ? fmtMoney(precioPromedioPorKm) : "—"
          }
        />
        <StatTile
          label="Costo prom. / litro"
          value={listo ? fmtMoney(data.precioPorLitro) : "—"}
        />
        <StatTile
          label="Km recorridos"
          value={listo && totalKmFlota > 0 ? `${fmtNum(totalKmFlota)} km` : "—"}
        />
        <StatTile
          label="Gasto total"
          value={listo ? fmtMoney(data.totalImporte) : "—"}
          trend={data?.costoTotalPeriodo?.changePct ?? null}
        />
      </div>

      {listo && (
        <div className="flex flex-col gap-3">
          <div
            className="flex w-fit gap-1 rounded border border-black/10 bg-white p-1.5"
            role="tablist"
            aria-label="Métrica del gráfico de evolución"
          >
            <button
              type="button"
              role="tab"
              aria-selected={metricaChart === "km"}
              onClick={() => setMetricaChart("km")}
              className={`rounded px-4 py-2 text-sm font-[family-name:var(--font-ui)] uppercase tracking-wider transition-colors ${
                metricaChart === "km"
                  ? "bg-vialto-charcoal text-vialto-fire"
                  : "text-vialto-steel hover:text-vialto-charcoal"
              }`}
            >
              $/km
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={metricaChart === "litro"}
              onClick={() => setMetricaChart("litro")}
              className={`rounded px-4 py-2 text-sm font-[family-name:var(--font-ui)] uppercase tracking-wider transition-colors ${
                metricaChart === "litro"
                  ? "bg-vialto-charcoal text-vialto-fire"
                  : "text-vialto-steel hover:text-vialto-charcoal"
              }`}
            >
              $/litro
            </button>
          </div>

          {metricaChart === "km" ? (
            <EvolucionCostoPorKmChart puntos={data.evolucionCostoPorKm} />
          ) : (
            <EvolucionPrecioChart puntos={data.evolucionPrecio} />
          )}
        </div>
      )}

      {listo && data.totalCargas === 0 && (
        <p className="text-sm text-vialto-steel">
          Sin cargas en el período seleccionado.
        </p>
      )}
    </div>
  );
}

// ── Por vehículo ─────────────────────────────────────────────────────────

export function VehiculoRankingTable({
  items,
  periodo,
}: {
  items: CombustiblePorVehiculoItem[];
  /** Rango del dashboard actual, para armar el link "Ver cargas" filtrado. */
  periodo?: { from: string; to: string } | null;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-vialto-steel">
        Sin cargas en el período seleccionado.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto bg-white border border-black/10 p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Vehículo
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Litros
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Costo/km
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              L/100km
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Monto
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Cargas
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => {
            const qs = new URLSearchParams({ vehiculoId: v.vehiculoId });
            if (periodo?.from) qs.set("from", periodo.from);
            if (periodo?.to) qs.set("to", periodo.to);
            return (
              <tr
                key={v.vehiculoId}
                className="border-b border-black/5 last:border-0"
              >
                <td className="py-2">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <SemaforoDot color={v.semaforo} />
                    <span className="font-medium text-vialto-charcoal">
                      {v.patente}
                    </span>
                    <span className="text-xs text-vialto-steel">
                      {fmtTipoVehiculo(v.tipo)}
                    </span>
                    {v.esOutlier && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                        Consume más que su categoría
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {fmtLitros(v.litros)}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {v.costoPorKm != null ? fmtMoney(v.costoPorKm) : "—"}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {v.litrosPor100Km != null
                    ? `${v.litrosPor100Km.toFixed(1)} L`
                    : "—"}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {fmtMoney(v.monto)}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {v.cantidad}
                </td>
                <td className="py-2 text-right">
                  <Link
                    to={`/combustible?${qs.toString()}`}
                    className="inline-flex items-center whitespace-nowrap text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-fire"
                  >
                    Ver cargas →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Por chofer ───────────────────────────────────────────────────────────

export function ChoferRankingTable({
  items,
  periodo,
}: {
  items: CombustiblePorChoferItem[];
  /** Rango del dashboard actual, para armar el link "Ver cargas" filtrado. */
  periodo?: { from: string; to: string } | null;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-vialto-steel">
        Sin cargas en el período seleccionado.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto bg-white border border-black/10 p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Chofer
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Litros
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Monto
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Cargas
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const qs = c.choferId
              ? new URLSearchParams({ choferId: c.choferId })
              : null;
            if (qs) {
              if (periodo?.from) qs.set("from", periodo.from);
              if (periodo?.to) qs.set("to", periodo.to);
            }
            return (
              <tr
                key={c.choferId ?? "sin-chofer"}
                className="border-b border-black/5 last:border-0"
              >
                <td className="py-2 text-vialto-charcoal">{c.nombre}</td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {fmtLitros(c.litros)}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {fmtMoney(c.monto)}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {c.cantidad}
                </td>
                <td className="py-2 text-right">
                  {qs && (
                    <Link
                      to={`/combustible?${qs.toString()}`}
                      className="inline-flex items-center whitespace-nowrap text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-fire"
                    >
                      Ver cargas →
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Distribución (estación / forma de pago) — gráfico de torta ──────────

const DONUT_HUES = [
  "#2a78d6", // blue
  "#008300", // green
  "#e87ba4", // magenta
  "#eda100", // yellow
];
const DONUT_OTRAS_HUE = "#c3c2b7";
const DONUT_MAX_SLICES = 4;
const DONUT_GAP_PCT = 0.6;
const DONUT_R = 15.9155;

type DonutSlice = {
  clave: string;
  label: string;
  monto: number;
  litros: number;
  cantidad: number;
  precioPromedio: number;
  color: string;
};

function buildDonutSlices(
  items: CombustibleDistribucionItem[],
  labelFor: (clave: string) => string,
): DonutSlice[] {
  const ordenado = [...items].sort((a, b) => b.monto - a.monto);
  const top = ordenado.slice(0, DONUT_MAX_SLICES);
  const resto = ordenado.slice(DONUT_MAX_SLICES);

  const slices: DonutSlice[] = top.map((it, i) => ({
    clave: it.clave,
    label: labelFor(it.clave),
    monto: it.monto,
    litros: it.litros,
    cantidad: it.cantidad,
    precioPromedio: it.precioPromedio,
    color: DONUT_HUES[i % DONUT_HUES.length],
  }));

  if (resto.length > 0) {
    const montoResto = resto.reduce((s, it) => s + it.monto, 0);
    const litrosResto = resto.reduce((s, it) => s + it.litros, 0);
    const cantidadResto = resto.reduce((s, it) => s + it.cantidad, 0);
    slices.push({
      clave: "__otras__",
      label: `Otras (${resto.length})`,
      monto: montoResto,
      litros: litrosResto,
      cantidad: cantidadResto,
      precioPromedio: litrosResto > 0 ? montoResto / litrosResto : 0,
      color: DONUT_OTRAS_HUE,
    });
  }

  return slices;
}

function DonutChart({
  slices,
  total,
}: {
  slices: DonutSlice[];
  total: number;
}) {
  const [hoverClave, setHoverClave] = useState<string | null>(null);

  let acumulado = 0;
  const arcos = slices.map((s) => {
    const pct = total > 0 ? (s.monto / total) * 100 : 0;
    const visible = Math.max(0, pct - DONUT_GAP_PCT);
    const offset = -acumulado;
    acumulado += pct;
    return { slice: s, pct, visible, offset };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle
            cx="21"
            cy="21"
            r={DONUT_R}
            fill="transparent"
            stroke="#e1e0d9"
            strokeWidth="6"
          />
          {arcos.map(({ slice, visible, offset, pct }) => {
            const esHover = hoverClave === slice.clave;
            const atenuado = hoverClave !== null && !esHover;
            return (
              <circle
                key={slice.clave}
                cx="21"
                cy="21"
                r={DONUT_R}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={esHover ? 7.5 : 6}
                strokeDasharray={`${visible} ${100 - visible}`}
                strokeDashoffset={offset}
                opacity={atenuado ? 0.35 : 1}
                className="cursor-pointer transition-[opacity,stroke-width]"
                tabIndex={0}
                role="img"
                aria-label={`${slice.label}: ${pct.toFixed(1)}%, ${fmtMoney(slice.monto)}, ${fmtLitros(slice.litros)}, ${slice.cantidad} ${slice.cantidad === 1 ? "carga" : "cargas"}`}
                onPointerEnter={() => setHoverClave(slice.clave)}
                onPointerLeave={() => setHoverClave(null)}
                onFocus={() => setHoverClave(slice.clave)}
                onBlur={() => setHoverClave(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
          <span className="max-w-[76px] truncate font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.1em] text-vialto-steel">
            {hoverClave
              ? (slices.find((s) => s.clave === hoverClave)?.label ?? "Total")
              : "Total"}
          </span>
          <span className="max-w-[76px] text-center text-[13px] font-semibold leading-tight break-words text-vialto-charcoal">
            {fmtMoney(
              hoverClave
                ? (slices.find((s) => s.clave === hoverClave)?.monto ?? total)
                : total,
            )}
          </span>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2 self-stretch">
        {arcos.map(({ slice, pct }) => (
          <li
            key={slice.clave}
            className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded px-1.5 py-1 transition-colors ${
              hoverClave === slice.clave ? "bg-vialto-mist/60" : ""
            }`}
            onPointerEnter={() => setHoverClave(slice.clave)}
            onPointerLeave={() => setHoverClave(null)}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
                aria-hidden
              />
              <span className="min-w-0 truncate text-sm font-medium text-vialto-charcoal">
                {slice.label}
              </span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-vialto-steel">
              {pct.toFixed(1)}% · {fmtMoney(slice.monto)} ·{" "}
              {fmtLitros(slice.litros)} · {slice.cantidad}{" "}
              {slice.cantidad === 1 ? "carga" : "cargas"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DistribucionPanel({
  titulo,
  items,
  labelFor,
}: {
  titulo: string;
  items: CombustibleDistribucionItem[];
  labelFor: (clave: string) => string;
}) {
  const total = items.reduce((s, it) => s + it.monto, 0);
  const slices = buildDonutSlices(items, labelFor);
  return (
    <div className="bg-white border border-black/10 p-4">
      <p className="mb-3 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
        {titulo}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-vialto-steel">
          Sin cargas en el período seleccionado.
        </p>
      ) : (
        <DonutChart slices={slices} total={total} />
      )}
    </div>
  );
}

export function fmtFormaPagoClave(clave: string): string {
  if (clave === "sin_especificar") return "Sin especificar";
  return fmtFormaPago(clave);
}

// ── Alertas ──────────────────────────────────────────────────────────────

export function AlertasList({
  alertas,
  tenantId,
}: {
  alertas: CombustibleAlerta[];
  tenantId: string; // <-- AÑADIDO
}) {
  const [viewingCargaId, setViewingCargaId] = useState<string | null>(null);

  if (alertas.length === 0) {
    return (
      <div className="bg-white border border-black/10 p-4">
        <p className="text-sm text-vialto-steel">
          Sin cargas marcadas como sospechosas en el período.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto bg-white border border-black/10 p-4">
      <table className="w-full text-sm">
        {/* ... (el thead queda exactamente igual) ... */}
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Tipo
            </th>
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Fecha
            </th>
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Vehículo
            </th>
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Conductor
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Litros
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Costo/L
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Monto
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {alertas.map((a) => {
            return (
              <tr
                key={a.cargaId}
                className="border-b border-black/5 last:border-0"
              >
                <td className="py-2">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <SemaforoDot color="rojo" />
                    {motivoShortLabel(a.motivoSospecha)}
                  </span>
                </td>
                <td className="py-2 whitespace-nowrap text-vialto-charcoal">
                  {fmtFecha(a.fecha)}
                </td>
                <td className="py-2 font-medium text-vialto-charcoal">
                  {a.patente}
                </td>
                <td className="py-2 text-vialto-charcoal">
                  {a.choferNombre ?? "—"}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {fmtLitros(a.litros)}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {fmtMoney(a.precioPorLitro)}
                </td>
                <td className="py-2 text-right text-vialto-charcoal">
                  {fmtMoney(a.importe)}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setViewingCargaId(a.cargaId)}
                    className="inline-flex items-center whitespace-nowrap text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-fire"
                  >
                    Ver carga →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {viewingCargaId && (
        <CargaCombustibleViewModal
          cargaId={viewingCargaId}
          tenantId={tenantId}
          onClose={() => setViewingCargaId(null)}
        />
      )}
    </div>
  );
}

// ── Evolución (precio por litro / costo por km) ─────────────────────────

const CHART_H = 220;
const CHART_PAD = { top: 16, right: 16, bottom: 28, left: 56 };
const PLOT_H = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

/** Mide en px el ancho real del elemento referenciado y lo mantiene actualizado ante resize. */
function useChartWidth<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(960);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

function niceStep(rawStep: number): number {
  if (rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

type PuntoEvolucion = {
  etiqueta: string;
  desde: string;
  hasta: string;
  valor: number;
};

function EvolucionChartBase({
  puntos,
  titulo,
  descripcion,
  unidadSufijo,
  mensajeVacio,
}: {
  puntos: PuntoEvolucion[];
  titulo: string;
  descripcion: string;
  unidadSufijo: string;
  mensajeVacio: string;
}) {
  const navigate = useNavigate();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [containerRef, chartW] = useChartWidth<HTMLDivElement>();
  const plotW = Math.max(0, chartW - CHART_PAD.left - CHART_PAD.right);
  const fmtValor = (n: number) => `${fmtMoney(n)}${unidadSufijo}`;

  if (puntos.length === 0) {
    return (
      <div className="bg-white border border-black/10 p-4">
        <p className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
          {titulo}
        </p>
        <p className="mt-2 text-sm text-vialto-steel">{mensajeVacio}</p>
      </div>
    );
  }

  const valores = puntos.map((p) => p.valor);
  const minVal = Math.min(...valores);
  const maxVal = Math.max(...valores);
  const maxIdx = valores.indexOf(maxVal);
  const minIdx = valores.indexOf(minVal);
  const primero = puntos[0].valor;
  const ultimo = puntos[puntos.length - 1].valor;

  const rango = maxVal - minVal;
  const colchon = rango > 0 ? rango * 0.2 : Math.max(1, maxVal * 0.1 || 1);
  const yMin = Math.max(0, minVal - colchon);
  const yMax = maxVal + colchon;
  const tickStep = niceStep((yMax - yMin) / 4);
  const yTicks: number[] = [];
  for (
    let v = Math.ceil(yMin / tickStep) * tickStep;
    v <= yMax;
    v += tickStep
  ) {
    yTicks.push(Math.round(v * 100) / 100);
  }
  const yRange = yMax - yMin || 1;
  const yToPx = (v: number) =>
    CHART_PAD.top + PLOT_H - ((v - yMin) / yRange) * PLOT_H;

  const stepX = puntos.length > 1 ? plotW / (puntos.length - 1) : 0;
  const coords = puntos.map((p, i) => ({
    x: CHART_PAD.left + i * stepX,
    y: yToPx(p.valor),
    p,
  }));

  const pathD = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const baseY = CHART_PAD.top + PLOT_H;
  const areaD =
    coords.length > 0
      ? `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${baseY} L ${coords[0].x.toFixed(1)} ${baseY} Z`
      : "";

  const maxXLabels = 6;
  const labelStep = Math.max(1, Math.ceil(puntos.length / maxXLabels));
  const xLabelIndices = new Set<number>();
  for (let i = 0; i < puntos.length; i += labelStep) xLabelIndices.add(i);
  xLabelIndices.add(puntos.length - 1);

  function handlePointerMove(e: ReactPointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    const localX = CHART_PAD.left + fraction * plotW;
    let nearest = 0;
    let nearestDist = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - localX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  function handleChartClick() {
    if (hoverIndex !== null) {
      const p = coords[hoverIndex].p;
      const qs = new URLSearchParams();

      const fechaPunto = p.desde ? p.desde.split("T")[0] : "";

      if (fechaPunto) {
        qs.set("from", fechaPunto);
        qs.set("to", fechaPunto);

        navigate(`/combustible?${qs.toString()}`);
      }
    }
  }

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className="bg-white border border-black/10 p-4">
      <p className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
        {titulo}
      </p>
      <p className="mt-1 text-xs text-vialto-steel">{descripcion}</p>

      <div ref={containerRef} className="relative mt-4">
        <svg
          viewBox={`0 0 ${chartW} ${CHART_H}`}
          className="w-full"
          style={{ height: CHART_H }}
          role="img"
          aria-label={`${titulo}: de ${fmtValor(primero)} a ${fmtValor(ultimo)} entre ${puntos[0].etiqueta} y ${puntos[puntos.length - 1].etiqueta}. Mínimo ${fmtValor(minVal)}, máximo ${fmtValor(maxVal)}.`}
        >
          {yTicks.map((v, i) => {
            const y = yToPx(v);
            return (
              <g key={i}>
                <line
                  x1={CHART_PAD.left}
                  x2={chartW - CHART_PAD.right}
                  y1={y}
                  y2={y}
                  className="stroke-black/10"
                  strokeWidth={1}
                />
                <text
                  x={CHART_PAD.left - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-vialto-steel"
                  fontSize={10}
                >
                  {fmtMoney(v)}
                </text>
              </g>
            );
          })}

          {areaD && (
            <path d={areaD} className="fill-vialto-fire/10" stroke="none" />
          )}
          <path
            d={pathD}
            fill="none"
            className="stroke-vialto-fire"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coords.map(
            (c, i) =>
              xLabelIndices.has(i) && (
                <text
                  key={i}
                  x={c.x}
                  y={CHART_H - 8}
                  textAnchor="middle"
                  className="fill-vialto-steel"
                  fontSize={10}
                >
                  {c.p.etiqueta}
                </text>
              ),
          )}

          {hovered && (
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={CHART_PAD.top}
              y2={baseY}
              className="stroke-vialto-charcoal/25"
              strokeWidth={1}
            />
          )}

          {coords.map((c, i) => {
            const esExtremo =
              (i === maxIdx || i === minIdx) && maxIdx !== minIdx;
            const esHover = i === hoverIndex;
            const color =
              i === maxIdx
                ? "fill-rose-500"
                : i === minIdx
                  ? "fill-emerald-500"
                  : "fill-vialto-fire";
            return (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={esHover ? 6 : esExtremo ? 5 : 3}
                className={`${color} stroke-white`}
                strokeWidth={2}
              />
            );
          })}

          <rect
            x={CHART_PAD.left}
            y={CHART_PAD.top}
            width={plotW}
            height={PLOT_H}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
            onClick={handleChartClick}
            className={hoverIndex !== null ? "cursor-pointer" : ""}
          />
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded border border-black/10 bg-white px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${(hovered.x / chartW) * 100}%`,
              top: `${(hovered.y / CHART_H) * 100}%`,
            }}
          >
            <p className="font-semibold text-vialto-charcoal">
              {fmtValor(hovered.p.valor)}
            </p>
            <p className="text-vialto-steel">{hovered.p.etiqueta}</p>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.1em] text-vialto-fire">
              Ver cargas →
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-vialto-steel">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"
            aria-hidden
          />
          Mínimo:{" "}
          <span className="font-medium text-vialto-charcoal">
            {fmtValor(minVal)}
          </span>{" "}
          ({puntos[minIdx].etiqueta})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500"
            aria-hidden
          />
          Máximo:{" "}
          <span className="font-medium text-vialto-charcoal">
            {fmtValor(maxVal)}
          </span>{" "}
          ({puntos[maxIdx].etiqueta})
        </span>
      </div>
    </div>
  );
}

export function EvolucionPrecioChart({
  puntos,
}: {
  puntos: CombustibleEvolucionPrecioPunto[];
}) {
  return (
    <EvolucionChartBase
      puntos={puntos.map((p: any) => ({
        ...p,
        valor: p.precioPromedio,
        desde: p.desde || p.fechaInicio || p.fecha,
        hasta: p.hasta || p.fechaFin || p.fecha,
      }))}
      titulo="Evolución del precio pagado por litro"
      descripcion="Precio promedio ($/L) pagado en cada tramo del período seleccionado."
      unidadSufijo="/L"
      mensajeVacio="Sin cargas registradas en el período seleccionado."
    />
  );
}

export function EvolucionCostoPorKmChart({
  puntos,
}: {
  puntos: CombustibleEvolucionCostoPorKmPunto[];
}) {
  return (
    <EvolucionChartBase
      puntos={puntos.map((p: any) => ({
        ...p,
        valor: p.costoPorKm,
        // ⚠️ Igual que arriba, aseguramos el mapeo de las fechas.
        desde: p.desde || p.fechaInicio || p.fecha,
        hasta: p.hasta || p.fechaFin || p.fecha,
      }))}
      titulo="Evolución del costo por km recorrido"
      descripcion="Costo promedio ($/km) de la flota en cada tramo del período seleccionado."
      unidadSufijo="/km"
      mensajeVacio="Sin km recorridos registrados en el período seleccionado."
    />
  );
}

// ── Cruce con Viajes ──────────────────────────────────────────────────────

export function ViajesCruceTable({
  items,
}: {
  items: CombustibleViajesCruceItem[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-vialto-steel">
        Aproximado: si un viaje usa más de un vehículo (ej. tractor +
        semirremolque), el km del viaje se cuenta completo para cada uno. Los
        viajes sin km cargado no participan del cálculo.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-vialto-steel">
          Sin datos de viajes para cruzar en el período.
        </p>
      ) : (
        <div className="overflow-x-auto bg-white border border-black/10 p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10">
                <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                  Vehículo
                </th>
                <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                  Litros cargados
                </th>
                <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                  Km facturados
                </th>
                <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                  L/100km facturado
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr
                  key={i.vehiculoId}
                  className="border-b border-black/5 last:border-0"
                >
                  <td className="py-2 text-vialto-charcoal">{i.patente}</td>
                  <td className="py-2 text-right text-vialto-charcoal">
                    {fmtLitros(i.litrosPeriodo)}
                  </td>
                  <td className="py-2 text-right text-vialto-charcoal">
                    {i.kmFacturadosPeriodo != null
                      ? `${fmtNum(i.kmFacturadosPeriodo)} km`
                      : "—"}
                  </td>
                  <td className="py-2 text-right text-vialto-charcoal">
                    {i.litrosPor100KmFacturado != null
                      ? `${i.litrosPor100KmFacturado.toFixed(1)} L`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
