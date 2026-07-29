import { useEffect, useState } from "react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import { LiquidacionMontosBreakdown } from "@/components/liquidaciones/LiquidacionMontosBreakdown";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import type {
  Liquidacion,
  LiquidacionConceptoLinea,
  LiquidacionEstado,
} from "@/types/api";

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

/** Normaliza líneas por si el payload viene incompleto o con alias. */
function normalizeConceptosLineas(
  raw: LiquidacionConceptoLinea[] | null | undefined,
): LiquidacionConceptoLinea[] {
  if (!raw?.length) return [];
  return raw.map((l, i) => {
    const row = l as LiquidacionConceptoLinea & { nombre?: string };
    const signo =
      String(row.signo ?? "").toLowerCase() === "contra" ? "contra" : "favor";
    return {
      ...row,
      id: row.id || `linea-${i}`,
      nombreSnapshot: row.nombreSnapshot || row.nombre || "Concepto",
      signo,
      monto: Number(row.monto) || 0,
      ivaPct: row.ivaPct != null ? Number(row.ivaPct) : 0,
      orden: row.orden ?? i,
      conceptoLiquidacionId: row.conceptoLiquidacionId ?? null,
    };
  });
}

export function LiquidacionViewModal({
  liq,
  ivaPct,
  canEdit = true,
  getToken,
  detalleUrl,
  onClose,
  onEditar,
  onVerComprobante,
}: {
  liq: LiquidacionConTransportista;
  ivaPct?: number;
  canEdit?: boolean;
  /** Si se pasa, el modal refetch el detalle (incluye conceptosLineas). */
  getToken?: () => Promise<string | null>;
  detalleUrl?: string;
  onClose: () => void;
  onEditar: () => void;
  onVerComprobante?: () => void;
}) {
  const [detail, setDetail] = useState<LiquidacionConTransportista>(liq);
  const [loadingDetail, setLoadingDetail] = useState(Boolean(getToken));

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!getToken) {
      setDetail({
        ...liq,
        conceptosLineas: normalizeConceptosLineas(liq.conceptosLineas),
      });
      setLoadingDetail(false);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const full = await apiJson<LiquidacionConTransportista>(
          detalleUrl ??
            `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setDetail({
            ...full,
            transportista: full.transportista ?? liq.transportista,
            conceptosLineas: normalizeConceptosLineas(
              full.conceptosLineas?.length
                ? full.conceptosLineas
                : liq.conceptosLineas,
            ),
          });
        }
      } catch {
        if (!cancelled) {
          setDetail({
            ...liq,
            conceptosLineas: normalizeConceptosLineas(liq.conceptosLineas),
          });
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Solo re-fetch al cambiar de liquidación (mismo patrón que EditModal).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liq se usa como fallback
  }, [getToken, detalleUrl, liq.id]);

  const source = detail;
  const transportistaNombre =
    source.transportista?.nombre ?? source.transportistaId;
  const ivaPctEfectivo = ivaPct ?? source.ivaPct ?? null;
  const conceptosLineas = normalizeConceptosLineas(source.conceptosLineas);

  return (
    <ViewModalShell
      title={
        <span className="inline-flex items-center gap-3">
          <span>Detalle de liquidación</span>
          <span
            className={[
              "text-xs font-medium border rounded px-2 py-0.5",
              ESTADO_BADGE[source.estado],
            ].join(" ")}
          >
            {ESTADO_LABEL[source.estado]}
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
            {source.transportista?.idFiscal && (
              <p className="mt-0.5 text-xs text-vialto-steel">
                CUIT {source.transportista.idFiscal}
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.2em] text-vialto-steel">
            Detalle del comprobante
          </p>
          <div className="rounded border border-black/10 bg-white px-4 py-1 min-h-[4rem]">
            {loadingDetail ? (
              <div className="flex justify-center py-6">
                <Spinner className="h-5 w-5" />
              </div>
            ) : (
              <LiquidacionMontosBreakdown
                variant="filas"
                bruto={source.bruto}
                comision={source.comision}
                comisionPct={source.comisionPct}
                conceptosLineas={conceptosLineas}
                gastosAdminIva={source.gastosAdminIva}
                ivaPct={ivaPctEfectivo}
                liquido={source.liquido}
              />
            )}
          </div>
        </div>

        <div className={viewModalGridClass}>
          <Campo
            label="Período"
            value={`${fmtDate(source.periodoDesde)} — ${fmtDate(source.periodoHasta)}`}
          />
          <Campo label="Viajes" value={source.cantViajes} />
          <Campo
            label="Tipo de comprobante"
            value={CBTE_TIPO[source.cbteTipo] ?? `Tipo ${source.cbteTipo}`}
          />
          {source.cbteNro != null && (
            <Campo label="Nº comprobante" value={source.cbteNro} />
          )}
          {source.ptoVenta != null && (
            <Campo label="Punto de venta" value={source.ptoVenta} />
          )}
          {source.cae && <Campo label="CAE" value={source.cae} />}
          {source.caeFechaVto && (
            <Campo label="Vto. CAE" value={fmtDate(source.caeFechaVto)} />
          )}
          <Campo label="Creada" value={fmtDate(source.createdAt)} />
        </div>

        {source.arcaError && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {source.arcaError}
          </div>
        )}

        {onVerComprobante && source.comprobanteUrl?.trim() && (
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
