import type { ConceptoLiquidacionSigno } from "@/types/api";
import {
  fmtLiquidacionMoney,
  fmtSignedLiquidacionMoney,
  round2,
} from "@/lib/liquidacionMoney";

// Re-export para no romper imports existentes.
export { fmtLiquidacionMoney, fmtSignedLiquidacionMoney };

type ConceptoLineaDisplay = {
  id?: string;
  nombreSnapshot: string;
  signo: ConceptoLiquidacionSigno;
  monto: number;
  ivaPct?: number | null;
};

type Props = {
  bruto: number;
  comision: number;
  comisionPct: number;
  conceptosLineas?: ConceptoLineaDisplay[];
  gastosAdminIva: number;
  ivaPct?: number | null;
  liquido: number;
  /** `rows` = EmitirCvlpModal; `filas` = EmitirLiquidacionModal; `campos` = ViewModal grid */
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

/**
 * IVA del comprobante = neto gravado × alícuota de la liquidación.
 * No se usa `gastosAdminIva` persistido: puede estar desfasado por bugs
 * previos (remap AFIP 10%→21% / 10%→10.5%).
 */
function resolveIvaYTotal(args: {
  bruto: number;
  comision: number;
  conceptosLineas: ConceptoLineaDisplay[];
  ivaPct?: number | string | null;
  gastosAdminIva: number;
  liquido: number;
}): { netoGravado: number; ivaMonto: number; total: number; ivaPct: number | null } {
  const efectoConceptos = args.conceptosLineas.reduce((s, l) => {
    const m = Number(l.monto) || 0;
    return s + (l.signo === "favor" ? m : -m);
  }, 0);
  const netoGravado = round2(
    Number(args.bruto) - Number(args.comision) + efectoConceptos,
  );
  const pct = coerceIvaPct(args.ivaPct);

  if (pct == null) {
    return {
      netoGravado: round2(Number(args.liquido) - Number(args.gastosAdminIva)),
      ivaMonto: Number(args.gastosAdminIva) || 0,
      total: Number(args.liquido) || 0,
      ivaPct: null,
    };
  }

  // Misma regla que el backend: el IVA de la liquidación aplica a todo el neto
  // (flete − comisión ± conceptos). El campo IVA del formulario es la fuente de verdad.
  const impIva = round2((netoGravado * pct) / 100);

  return {
    netoGravado,
    ivaMonto: impIva,
    total: round2(netoGravado + impIva),
    ivaPct: pct,
  };
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
 * Desglose de montos del comprobante CVLP / liquidación:
 * subtotal, comisión (−), conceptos (+/−), neto gravado, IVA (+), total.
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
  brutoLabel = "Sub total",
  totalLabel = "Total neto a liquidar",
}: Props) {
  const { netoGravado, ivaMonto, total, ivaPct: pctEfectivo } = resolveIvaYTotal(
    {
      bruto,
      comision,
      conceptosLineas,
      ivaPct,
      gastosAdminIva,
      liquido,
    },
  );
  const ivaLabel = formatIvaLabel(pctEfectivo);
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
      const signed = row.signo === "favor" ? row.monto : -row.monto;
      const nombre = row.nombreSnapshot || row.nombre || "Concepto";
      const linePct = coerceIvaPct(row.ivaPct);
      return {
        key: row.id ?? `concepto-${idx}`,
        label: `${nombre}${linePct != null ? ` (IVA ${formatIvaLabel(linePct).replace(/^IVA /, "")})` : ""}`,
        value: fmtSignedLiquidacionMoney(
          Math.abs(signed),
          signed >= 0 ? "plus" : "minus",
        ),
        muted: true,
      };
    }),
    {
      key: "neto",
      label: "Neto gravado",
      value: fmtLiquidacionMoney(netoGravado),
      separator: true,
    },
    {
      key: "iva",
      label: ivaLabel,
      value: fmtSignedLiquidacionMoney(ivaMonto, "plus"),
      muted: true,
    },
    {
      key: "total",
      label: totalLabel,
      value: fmtLiquidacionMoney(total),
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
