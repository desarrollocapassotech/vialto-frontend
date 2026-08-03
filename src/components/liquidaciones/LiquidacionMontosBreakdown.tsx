import type { ConceptoLiquidacionSigno } from "@/types/api";

export function fmtLiquidacionMoney(n: number) {
  return `$${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Formatea un importe con signo explícito para leer el cálculo. */
export function fmtSignedLiquidacionMoney(
  amount: number,
  sign: "plus" | "minus" | "none" = "none",
) {
  const abs = Math.abs(amount);
  const money = fmtLiquidacionMoney(abs);
  if (sign === "plus") return `+ ${money}`;
  if (sign === "minus") return `− ${money}`;
  return money;
}

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
  const netoGravado = Math.round((liquido - gastosAdminIva) * 100) / 100;
  const ivaLabel =
    ivaPct != null && Number.isFinite(ivaPct) ? `IVA ${ivaPct}%` : "IVA";
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
      return {
        key: row.id ?? `concepto-${idx}`,
        label: `${nombre}${row.ivaPct != null ? ` (IVA ${row.ivaPct}%)` : ""}`,
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
