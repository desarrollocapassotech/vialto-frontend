import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { apiJson } from "@/lib/api";
import {
  collectCvlpEmitMissingFields,
  formatCvlpEmitMissingMessage,
} from "@/lib/cvlpEmitValidation";
import { friendlyError } from "@/lib/friendlyError";
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

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const [detail, setDetail] = useState<LiquidacionEmitDetail | null>(null);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(
    arcaConfigProp ?? null,
  );
  const [datosReady, setDatosReady] = useState(false);

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
          setDatosReady(true);
        }
        return;
      }
      try {
        const cfg = await apiJson<ArcaConfig>(
          configUrl ?? "/api/integracion-arca/config",
          () => getToken(),
        );
        if (!cancelled) setArcaConfig(cfg);
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
  const conceptosLineas = source.conceptosLineas ?? [];
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

  async function confirmar() {
    if (datosEmitIncompletos) {
      setError(missingEmitMessage);
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
        { method: "POST" },
      );
      onSuccess({
        ...updated,
        transportista: source.transportista ?? liq.transportista,
      });
    } catch (e) {
      setError(friendlyError(e, "arca"));
    } finally {
      setSubmitting(false);
    }
  }

  const cbteTipoLabel = CBTE_TIPO[source.cbteTipo] ?? `Tipo ${source.cbteTipo}`;
  /** Neto implícito del total persistido (incluye efecto de conceptos). */
  const netoGravado =
    Math.round((source.liquido - source.gastosAdminIva) * 100) / 100;

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
        className="w-full max-w-md rounded border border-black/10 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
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

        <div className="px-6 py-5 space-y-4">
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
              <Fila label="Sub total" value={fmtMoney(source.bruto)} />
              <Fila
                label={`Comisión según convenio ${source.comisionPct}%`}
                value={fmtMoney(source.comision)}
                muted
              />
              {(source.gastosAdmin ?? 0) > 0 && (
                <Fila
                  label="Otras"
                  value={fmtMoney(source.gastosAdmin)}
                  muted
                />
              )}
              {conceptosLineas.map((l) => {
                const signed = l.signo === "favor" ? l.monto : -l.monto;
                return (
                  <Fila
                    key={l.id}
                    label={`${l.nombreSnapshot}${l.ivaPct != null ? ` (IVA ${l.ivaPct}%)` : ""}`}
                    value={`${signed >= 0 ? "+" : "−"} ${fmtMoney(Math.abs(signed))}`}
                    muted
                  />
                );
              })}
              {(() => {
                const ivaLabel = ivaPct != null ? `IVA ${ivaPct}%` : "IVA";
                return (
                  <>
                    <Fila
                      label="Neto gravado"
                      value={fmtMoney(netoGravado)}
                      separator
                    />
                    <Fila
                      label={ivaLabel}
                      value={fmtMoney(source.gastosAdminIva)}
                      muted
                    />
                    <Fila
                      label="Total neto a liquidar"
                      value={fmtMoney(source.liquido)}
                      bold
                      separator
                    />
                  </>
                );
              })()}
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
              className="rounded border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4">
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
            disabled={submitting || !datosReady || datosEmitIncompletos}
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
