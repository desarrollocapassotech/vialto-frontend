import { useEffect } from "react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import type { Liquidacion, LiquidacionEstado } from "@/types/api";

export type LiquidacionConTransportista = Liquidacion & {
  transportista?: {
    id: string;
    nombre: string;
    idFiscal: string | null;
  } | null;
};

const ESTADO_LABEL: Record<LiquidacionEstado, string> = {
  borrador: "Borrador",
  pendiente_cae: "Pendiente CAE",
  autorizado: "Autorizado",
  error: "Error",
  anulado: "Anulado",
};

const ESTADO_BADGE: Record<LiquidacionEstado, string> = {
  borrador: "bg-gray-100 text-gray-700 border-gray-300/80",
  pendiente_cae: "bg-amber-100 text-amber-800 border-amber-300/80",
  autorizado: "bg-emerald-100 text-emerald-800 border-emerald-400/80",
  error: "bg-red-100 text-red-800 border-red-300/80",
  anulado: "bg-gray-100 text-gray-500 border-gray-300/80",
};

const CBTE_TIPO: Record<number, string> = {
  60: "CVLP Tipo 60 (clase A)",
  61: "CVLP Tipo 61 (clase B)",
  1: "Factura A",
  6: "Factura B",
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function Campo({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
        {label}
      </p>
      <p className="mt-1 text-sm text-vialto-charcoal">{value ?? "—"}</p>
    </div>
  );
}

export function LiquidacionViewModal({
  liq,
  ivaPct,
  canEdit = true,
  onClose,
  onEditar,
  onVerComprobante,
}: {
  liq: LiquidacionConTransportista;
  ivaPct?: number;
  canEdit?: boolean;
  onClose: () => void;
  onEditar: () => void;
  onVerComprobante?: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const transportistaNombre =
    liq.transportista?.nombre ?? liq.transportistaId;
  const conceptosLineas = liq.conceptosLineas ?? [];
  const netoGravado =
    Math.round((liq.liquido - liq.gastosAdminIva) * 100) / 100;
  const ivaLabel = ivaPct != null ? `IVA ${ivaPct}%` : "IVA";

  return (
    <ViewModalShell
      title={
        <span className="inline-flex items-center gap-3">
          <span>Detalle de liquidación</span>
          <span
            className={[
              "text-xs font-medium border rounded px-2 py-0.5",
              ESTADO_BADGE[liq.estado],
            ].join(" ")}
          >
            {ESTADO_LABEL[liq.estado]}
          </span>
        </span>
      }
      onClose={onClose}
      scrollBody
      maxWidthClass="sm:max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={onEditar}
              className={viewModalBtnPrimary}
            >
              Editar
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.2em] text-vialto-steel">
            Destinatario
          </p>
          <div className="rounded border border-black/10 bg-vialto-mist px-4 py-3">
            <p className="font-medium text-vialto-charcoal">
              {transportistaNombre}
            </p>
            {liq.transportista?.idFiscal && (
              <p className="mt-0.5 text-xs text-vialto-steel">
                CUIT {liq.transportista.idFiscal}
              </p>
            )}
          </div>
        </div>

        <div className={viewModalGridClass}>
          <Campo
            label="Período"
            value={`${fmtDate(liq.periodoDesde)} — ${fmtDate(liq.periodoHasta)}`}
          />
          <Campo label="Viajes" value={liq.cantViajes} />
          <Campo label="Sub total" value={fmtMoney(liq.bruto)} />
          <Campo
            label={`Comisión (${liq.comisionPct}%)`}
            value={fmtMoney(liq.comision)}
          />
          {liq.gastosAdmin > 0 && (
            <Campo label="Gastos admin." value={fmtMoney(liq.gastosAdmin)} />
          )}
          {conceptosLineas.map((l) => {
            const signed = l.signo === "favor" ? l.monto : -l.monto;
            return (
              <Campo
                key={l.id}
                label={`${l.nombreSnapshot}${l.ivaPct != null ? ` (IVA ${l.ivaPct}%)` : ""}`}
                value={`${signed >= 0 ? "+" : "−"} ${fmtMoney(Math.abs(signed))}`}
              />
            );
          })}
          <Campo label="Neto gravado" value={fmtMoney(netoGravado)} />
          <Campo label={ivaLabel} value={fmtMoney(liq.gastosAdminIva)} />
          <Campo label="Total neto a liquidar" value={fmtMoney(liq.liquido)} />
          <Campo
            label="Tipo de comprobante"
            value={CBTE_TIPO[liq.cbteTipo] ?? `Tipo ${liq.cbteTipo}`}
          />
          {liq.cbteNro != null && (
            <Campo label="Nº comprobante" value={liq.cbteNro} />
          )}
          {liq.ptoVenta != null && (
            <Campo label="Punto de venta" value={liq.ptoVenta} />
          )}
          {liq.cae && <Campo label="CAE" value={liq.cae} />}
          {liq.caeFechaVto && (
            <Campo label="Vto. CAE" value={fmtDate(liq.caeFechaVto)} />
          )}
          <Campo label="Creada" value={fmtDate(liq.createdAt)} />
        </div>

        {liq.arcaError && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {liq.arcaError}
          </div>
        )}

        {onVerComprobante && liq.comprobanteUrl?.trim() && (
          <div className="border-t border-black/10 pt-4">
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
              Comprobante
            </p>
            <button
              type="button"
              onClick={onVerComprobante}
              className="mt-2 px-3 py-1.5 text-xs uppercase tracking-wider border border-black/20 hover:bg-vialto-mist"
            >
              Ver comprobante
            </button>
          </div>
        )}
      </div>
    </ViewModalShell>
  );
}
