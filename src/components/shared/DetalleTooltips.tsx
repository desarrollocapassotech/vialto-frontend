import { round2 } from "@/lib/liquidacionConceptosIva";
import { tooltipPanelClassBelow } from "@/lib/tooltip";

/**
 * Texto subrayado punteado con un tooltip de pares clave/valor (ej. "Viaje #123" con el
 * detalle del viaje). Lo usan los paneles de "Detalles del viaje" de Liquidaciones y Facturas.
 */
export function DetalleConTooltip({
  label,
  filas,
}: {
  label: string;
  filas: [string, string][];
}) {
  return (
    <div className="group relative min-w-0 pr-4">
      <span className="cursor-help text-vialto-charcoal underline decoration-dotted decoration-vialto-steel/60 underline-offset-4">
        {label}
      </span>
      <div className={tooltipPanelClassBelow}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {filas.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="text-white/60">{k}</dt>
              <dd className="tabular-nums">{val}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Importe con IVA; el tooltip muestra sin IVA, IVA y con IVA. */
export function MontoConIvaTooltip({
  base,
  ivaPct,
  formatMonto,
}: {
  base: number;
  ivaPct: number;
  formatMonto: (n: number) => string;
}) {
  const conIva = round2(base * (1 + (Number(ivaPct) || 0) / 100));
  const iva = round2(conIva - base);
  return (
    <div className="group relative shrink-0 text-right">
      <span className="cursor-help whitespace-nowrap font-medium tabular-nums text-vialto-charcoal underline decoration-dotted decoration-vialto-steel/60 underline-offset-4">
        {formatMonto(conIva)}
      </span>
      <div
        className={tooltipPanelClassBelow
          .replace("left-0", "right-0")
          .replace("w-[min(22rem,calc(100vw-2.5rem))]", "w-max")}
      >
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
          <dt className="text-white/60">Sin IVA</dt>
          <dd className="text-right tabular-nums">{formatMonto(base)}</dd>
          <dt className="text-white/60">IVA {ivaPct}%</dt>
          <dd className="text-right tabular-nums">{formatMonto(iva)}</dd>
          <dt className="text-white/60">Con IVA</dt>
          <dd className="text-right font-medium tabular-nums">{formatMonto(conIva)}</dd>
        </dl>
      </div>
    </div>
  );
}
