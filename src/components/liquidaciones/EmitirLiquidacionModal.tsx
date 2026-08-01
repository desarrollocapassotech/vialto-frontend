import { useEffect, useMemo, useRef, useState } from "react";
import { Receipt } from "lucide-react";
import { LiquidacionMontosBreakdown } from "@/components/liquidaciones/LiquidacionMontosBreakdown";
import { apiJson } from "@/lib/api";
import {
  collectCvlpEmitMissingFields,
  formatCvlpEmitMissingMessage,
} from "@/lib/cvlpEmitValidation";
import { friendlyError } from "@/lib/friendlyError";
import { getArcaErrorDetalle } from "@/lib/arcaErrorDetalle";
import { ArcaErrorMessage } from "@/components/ui/ArcaErrorMessage";
import { AmbienteHomologacionWarning } from "@/components/liquidaciones/AmbienteHomologacionWarning";
import { Spinner } from "@/components/ui/Spinner";
import type { ArcaConfig, Liquidacion } from "@/types/api";

type LiquidacionEmitDetail = Liquidacion & {
  transportista?: {
    id: string;
    nombre: string;
    idFiscal: string | null;
    domicilio?: string | null;
    condicionIva?: number | null;
  } | null;
  viajes?: Array<{
    viaje?: {
      cliente?: {
        nombre?: string | null;
        idFiscal?: string | null;
        direccion?: string | null;
      } | null;
    } | null;
  }>;
};

const CBTE_TIPO: Record<number, string> = {
  60: "CVLP Tipo 60 (clase A)",
  61: "CVLP Tipo 61 (clase B)",
  1: "Factura A",
  6: "Factura B",
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function Fila({
  label,
  value,
  muted,
  bold,
  separator,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
  separator?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${separator ? "border-t border-black/10 mt-1" : "border-b border-black/5 last:border-0"}`}
    >
      <span
        className={`text-xs ${muted ? "text-vialto-steel" : bold ? "font-medium text-vialto-charcoal" : "text-vialto-charcoal"}`}
      >
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${bold ? "font-semibold text-vialto-charcoal" : muted ? "text-vialto-steel" : "text-vialto-charcoal"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function EmitirLiquidacionModal({
  liq,
  getToken,
  onSuccess,
  onClose,
  emitirUrl,
  detalleUrl,
  configUrl,
  arcaConfig: arcaConfigProp,
  ivaPct,
}: {
  liq: LiquidacionEmitDetail;
  getToken: () => Promise<string | null>;
  onSuccess: (updated: LiquidacionEmitDetail) => void;
  onClose: () => void;
  /** URL del endpoint de emisión. Por defecto usa el endpoint de tenant. */
  emitirUrl?: string;
  /** GET detalle de liquidación (con cliente del viaje). Por defecto tenant. */
  detalleUrl?: string;
  /** GET config ARCA. Por defecto tenant. */
  configUrl?: string;
  /** Si ya está cargada en la página, evita un fetch extra. */
  arcaConfig?: ArcaConfig | null;
  /** Porcentaje de IVA configurado (ej: 21). Si no se pasa, se deduce de los valores guardados. */
  ivaPct?: number;
  tenantId?: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | undefined>(
    undefined,
  );
  const [detail, setDetail] = useState<LiquidacionEmitDetail | null>(null);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(
    arcaConfigProp ?? null,
  );
  const [datosReady, setDatosReady] = useState(false);
  /** Precargado con el punto de venta de la config ARCA; editable antes de emitir. */
  const [ptoVenta, setPtoVenta] = useState(
    arcaConfigProp?.ptoVentaCvlp != null
      ? String(arcaConfigProp.ptoVentaCvlp)
      : "",
  );
  const ptoVentaSynced = useRef(arcaConfigProp?.ptoVentaCvlp != null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  useEffect(() => {
    let cancelled = false;
    setDatosReady(false);
    void (async () => {
      try {
        const det = await apiJson<LiquidacionEmitDetail>(
          detalleUrl ??
            `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
          () => getToken(),
        );
        if (!cancelled) setDetail(det);
      } catch {
        if (!cancelled) setDetail(liq);
      }
      if (arcaConfigProp) {
        if (!cancelled) {
          setArcaConfig(arcaConfigProp);
          if (!ptoVentaSynced.current && arcaConfigProp.ptoVentaCvlp != null) {
            ptoVentaSynced.current = true;
            setPtoVenta(String(arcaConfigProp.ptoVentaCvlp));
          }
          setDatosReady(true);
        }
        return;
      }
      try {
        const cfg = await apiJson<ArcaConfig>(
          configUrl ?? "/api/integracion-arca/config",
          () => getToken(),
        );
        if (!cancelled) {
          setArcaConfig(cfg);
          if (!ptoVentaSynced.current && cfg.ptoVentaCvlp != null) {
            ptoVentaSynced.current = true;
            setPtoVenta(String(cfg.ptoVentaCvlp));
          }
        }
      } catch {
        // la validación reporta emisor incompleto
      }
      if (!cancelled) setDatosReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [liq.id, getToken, detalleUrl, configUrl, arcaConfigProp, liq]);

  const source = detail ?? liq;
  const ivaPctEfectivo = source.ivaPct ?? ivaPct;
  const missingEmitFields = useMemo(
    () =>
      collectCvlpEmitMissingFields({
        emisor: arcaConfig,
        transportista: source.transportista ?? {
          idFiscal: null,
          domicilio: null,
          condicionIva: null,
        },
        cliente: source.viajes?.[0]?.viaje?.cliente ?? null,
      }),
    [arcaConfig, source],
  );
  const missingEmitMessage = formatCvlpEmitMissingMessage(missingEmitFields);
  const datosEmitIncompletos = datosReady && missingEmitFields.length > 0;

  const ptoVentaNum = Number(ptoVenta);
  const ptoVentaInvalido =
    !ptoVenta.trim() || !Number.isInteger(ptoVentaNum) || ptoVentaNum < 1;

  async function confirmar() {
    if (datosEmitIncompletos) {
      setError(missingEmitMessage);
      return;
    }
    if (ptoVentaInvalido) {
      setError("Ingresá un punto de venta válido.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const url =
        emitirUrl ??
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/emitir`;
      const updated = await apiJson<LiquidacionEmitDetail>(
        url,
        () => getToken(),
        { method: "POST", body: JSON.stringify({ ptoVenta: ptoVentaNum }) },
      );
      onSuccess({
        ...updated,
        transportista: source.transportista ?? liq.transportista,
      });
    } catch (e) {
      setError(friendlyError(e, "arca"));
      setErrorDetalle(getArcaErrorDetalle(e));
    } finally {
      setSubmitting(false);
    }
  }

  const cbteTipoLabel = CBTE_TIPO[source.cbteTipo] ?? `Tipo ${source.cbteTipo}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-md max-h-[90dvh] flex-col rounded border border-black/10 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
            Emitir comprobante
          </h2>
          {!submitting && (
            <button
              type="button"
              onClick={onClose}
              className="text-vialto-steel hover:text-vialto-charcoal"
              aria-label="Cerrar"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel mb-2">
              Destinatario
            </p>
            <div className="rounded border border-black/10 bg-vialto-mist px-4 py-3">
              <p className="font-medium text-vialto-charcoal">
                {source.transportista?.nombre ??
                  liq.transportista?.nombre ??
                  liq.transportistaId}
              </p>
              {(source.transportista?.idFiscal ??
                liq.transportista?.idFiscal) && (
                <p className="text-xs text-vialto-steel mt-0.5">
                  CUIT{" "}
                  {source.transportista?.idFiscal ??
                    liq.transportista?.idFiscal}
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel mb-2">
              Detalle del comprobante
            </p>
            <div className="rounded border border-black/10 bg-white px-4 py-1">
              <Fila
                label="Período"
                value={`${fmtDate(source.periodoDesde)} — ${fmtDate(source.periodoHasta)}`}
                muted
              />
              <Fila label="Viajes" value={source.cantViajes} muted />
              <div className="border-t border-black/10 mt-1 pt-1">
                <LiquidacionMontosBreakdown
                  variant="filas"
                  bruto={source.bruto}
                  comision={source.comision}
                  comisionPct={source.comisionPct}
                  conceptosLineas={source.conceptosLineas}
                  gastosAdminIva={source.gastosAdminIva}
                  ivaPct={ivaPctEfectivo}
                  liquido={source.liquido}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded border border-black/10 bg-white px-4 py-2.5">
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel">
              Comprobante
            </span>
            <span className="text-sm text-vialto-charcoal">
              {cbteTipoLabel}
            </span>
          </div>

          <div className="rounded border border-black/10 bg-white px-4 py-2.5">
            <label
              htmlFor="ptoVentaEmitirLiquidacion"
              className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel"
            >
              Punto de venta
            </label>
            <input
              id="ptoVentaEmitirLiquidacion"
              type="number"
              min={1}
              value={ptoVenta}
              onChange={(e) => setPtoVenta(e.target.value)}
              disabled={submitting}
              className="mt-1 h-9 w-full rounded border border-black/15 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 disabled:opacity-60"
            />
          </div>

          {datosEmitIncompletos && (
            <div
              className="rounded border border-amber-400/40 bg-amber-50 px-4 py-3 text-xs text-amber-900"
              role="alert"
            >
              <p className="font-medium">
                Completá estos datos antes de emitir
              </p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {missingEmitFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {!datosEmitIncompletos && (
            <div className="rounded border border-amber-400/40 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Al confirmar se enviará el comprobante a ARCA para su
              autorización. Una vez emitido no puede modificarse.
            </div>
          )}

          {error && (
            <div
              className="rounded border border-red-300/50 bg-red-50 px-4 py-3 text-sm"
              role="alert"
            >
              <ArcaErrorMessage message={error} detalle={errorDetalle} />
            </div>
          )}

          <AmbienteHomologacionWarning ambiente={arcaConfig?.ambiente} />
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-black/10 px-6 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-9 px-4 rounded border border-black/20 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              submitting ||
              !datosReady ||
              datosEmitIncompletos ||
              ptoVentaInvalido
            }
            onClick={() => void confirmar()}
            className="inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-fire font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white hover:bg-vialto-bright disabled:opacity-50"
          >
            {submitting ? (
              <Spinner />
            ) : (
              <Receipt
                className="h-4 w-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
            )}
            {submitting ? "Emitiendo…" : "Emitir comprobante"}
          </button>
        </div>
      </div>
    </div>
  );
}
