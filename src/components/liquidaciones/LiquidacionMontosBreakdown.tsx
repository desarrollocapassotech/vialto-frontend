import type { ConceptoLiquidacionSigno } from "@/types/api";
import {
  fmtLiquidacionMoney,
  fmtSignedLiquidacionMoney,
  round2,
} from "@/lib/liquidacionMoney";
import { signedMontoNetoConcepto } from "@/lib/liquidacionConceptosIva";


// Re-export para no romper imports existentes.
export { fmtLiquidacionMoney, fmtSignedLiquidacionMoney };

type ConceptoLineaDisplay = {
  id?: string;
  nombreSnapshot: string;
  signo: ConceptoLiquidacionSigno;
  monto: number;
  ivaPct?: number | null;
  cantidad?: number;
  montoUnitario?: number | null;
};

type Props = {
  bruto: number;
  comision: number;
  comisionPct: number;
  conceptosLineas?: ConceptoLineaDisplay[];
  gastosAdminIva: number;
  ivaPct?: number | null;
  liquido: number;
  /** `rows` / `filas` = modales de emisión; `campos` = ViewModal grid */
  variant?: "rows" | "filas" | "campos";
  /** Etiqueta del bruto (Sub total vs Bruto). */
  brutoLabel?: string;
  totalLabel?: string;
};

function Row({
  label,
  value,
  muted,
  bold,
  separator,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  separator?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        separator
          ? "border-t border-black/10 pt-1.5 mt-0.5"
          : "border-b border-black/5 last:border-0 py-1.5"
      } ${bold ? "py-1.5" : ""}`}
    >
      <span
        className={`text-xs ${
          muted
            ? "text-vialto-steel"
            : bold
              ? "font-medium text-vialto-charcoal"
              : "text-vialto-charcoal"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${
          bold
            ? "font-semibold text-vialto-charcoal"
            : muted
              ? "text-vialto-steel"
              : "text-vialto-charcoal"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
        {label}
      </p>
      <p className="mt-1 text-sm tabular-nums text-vialto-charcoal">{value}</p>
    </div>
  );
}

function coerceIvaPct(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatIvaLabel(pct: number | null): string {
  if (pct == null) return "IVA";
  // Deja claro 10 vs 10,5 (AFIP) para no confundir al usuario.
  const text =
    Number.isInteger(pct) || Math.abs(pct - Math.round(pct)) < 1e-9
      ? String(Math.round(pct))
      : pct.toLocaleString("es-AR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
  return `IVA ${text}%`;
}

/**
 * Desglose de montos del comprobante CVLP / liquidación, con el mismo criterio que el PDF:
 * bruto, comisión (−), conceptos por su base sin IVA (+/−), neto gravado, IVA total
 * (flete/comisión + IVA de cada concepto) y total.
 */
export function LiquidacionMontosBreakdown({
  bruto,
  comision,
  comisionPct,
  conceptosLineas = [],
  gastosAdminIva,
  ivaPct,
  liquido,
  variant = "filas",
  brutoLabel = "Bruto",
  totalLabel = "Total neto a liquidar",
}: Props) {
  // `gastosAdminIva` es el IVA total de AFIP (incluye el IVA de los conceptos), igual que
  // la línea "IVA" del PDF. El total no se recalcula: es `liquido`.
  const conceptosNetoSum = conceptosLineas.reduce(
    (acc, l) => acc + signedMontoNetoConcepto(l.signo, Number(l.monto) || 0),
    0,
  );
  const netoGravado = round2(bruto - comision + conceptosNetoSum);
  const pctEfectivo = coerceIvaPct(ivaPct);
  // Con conceptos a otra alícuota no hay un único % para mostrar.
  const ivaUnico = conceptosLineas.every((l) => {
    const p = coerceIvaPct(l.ivaPct);
    return p == null || p === pctEfectivo;
  });
  const ivaLabel = ivaUnico ? formatIvaLabel(pctEfectivo) : "IVA";
  const comisionLabel = `Comisión (${comisionPct}%)`;

  const lineItems: {
    key: string;
    label: string;
    value: string;
    muted?: boolean;
    bold?: boolean;
    separator?: boolean;
  }[] = [
    {
      key: "bruto",
      label: brutoLabel,
      value: fmtSignedLiquidacionMoney(bruto, "plus"),
    },
    {
      key: "comision",
      label: comisionLabel,
      value: fmtSignedLiquidacionMoney(comision, "minus"),
      muted: true,
    },
    ...conceptosLineas.map((l, idx) => {
      const row = l as ConceptoLineaDisplay & { nombre?: string };
      const linePct = coerceIvaPct(row.ivaPct);
      const neto = signedMontoNetoConcepto(row.signo, Number(row.monto) || 0);
      const nombre = row.nombreSnapshot || row.nombre || "Concepto";
      const cantidad = Number(row.cantidad) || 1;
      const detalle = [
        cantidad !== 1 && row.montoUnitario != null
          ? `${cantidad.toLocaleString("es-AR")} × ${fmtLiquidacionMoney(row.montoUnitario)}`
          : null,
        linePct != null ? `IVA ${formatIvaLabel(linePct).replace(/^IVA /, "")}` : null,
      ].filter(Boolean);
      return {
        key: row.id ?? `concepto-${idx}`,
        label: `${nombre}${detalle.length ? ` (${detalle.join(", ")})` : ""}`,
        value: fmtSignedLiquidacionMoney(
          Math.abs(neto),
          neto >= 0 ? "plus" : "minus",
        ),
        muted: true,
      };
    }),
    {
      key: "subtotal",
      label: "Neto gravado",
      value: fmtLiquidacionMoney(netoGravado),
      separator: true,
    },
    {
      key: "iva",
      label: ivaLabel,
      value: fmtSignedLiquidacionMoney(gastosAdminIva, "plus"),
      muted: true,
    },
    {
      key: "total",
      label: totalLabel,
      value: fmtLiquidacionMoney(liquido),
      bold: true,
      separator: true,
    },
  ];

  if (variant === "campos") {
    return (
      <>
        {lineItems.map((item) => (
          <Campo key={item.key} label={item.label} value={item.value} />
        ))}
      </>
    );
  }

  if (variant === "rows") {
    return (
      <div className="space-y-1.5">
        {lineItems.map((item) => (
          <div
            key={item.key}
            className={`flex justify-between text-xs ${
              item.separator ? "border-t border-black/10 pt-1.5 mt-0.5" : ""
            } ${item.bold ? "font-semibold text-vialto-charcoal" : ""}`}
          >
            <span
              className={
                item.bold
                  ? "text-vialto-charcoal"
                  : item.muted
                    ? "text-vialto-steel"
                    : "text-vialto-steel"
              }
            >
              {item.label}
            </span>
            <span className="tabular-nums text-vialto-charcoal">{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {lineItems.map((item) => (
        <Row
          key={item.key}
          label={item.label}
          value={item.value}
          muted={item.muted}
          bold={item.bold}
          separator={item.separator}
        />
      ))}
    </div>
  );
}
