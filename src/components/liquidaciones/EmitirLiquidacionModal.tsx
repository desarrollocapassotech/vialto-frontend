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
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { CompletarDatosFiscalesInline } from "@/components/shared/CompletarDatosFiscalesInline";
import { Spinner } from "@/components/ui/Spinner";
import {
  CVLP_CLASE_B_WARNING,
  condicionIvaLabel,
  cvlpClaseBEsperada,
} from "@/lib/arcaCbteTipo";
import type { ArcaConfig, Cliente, Liquidacion, Transportista } from "@/types/api";

type LiquidacionEmitDetail = Liquidacion & {
  transportista?: {
    id: string;
    nombre: string;
    idFiscal: string | null;
    domicilio?: string | null;
    condicionIva?: number | null;
    pais?: string | null;
    condicionTributaria?: string | null;
  } | null;
  viajes?: Array<{
    viaje?: {
      cliente?: {
        id?: string | null;
        nombre?: string | null;
        idFiscal?: string | null;
        direccion?: string | null;
        pais?: string | null;
        condicionIva?: number | null;
        condicionTributaria?: string | null;
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
  tenantId,
  onDataSaved,
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
  /** Override de superadmin: si está presente, las ediciones inline usan rutas /api/platform/... */
  tenantId?: string;
  onDataSaved?: () => void;
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
  const missingEmisorFields = missingEmitFields.filter((f) => f.startsWith("Emisor:"));
  const missingTransportistaFields = missingEmitFields.filter((f) =>
    f.startsWith("Transportista:"),
  );
  const missingClienteFields = missingEmitFields.filter((f) => f.startsWith("Cliente:"));

  const transportistaId = source.transportista?.id ?? liq.transportista?.id ?? null;
  const clienteDelViaje = source.viajes?.[0]?.viaje?.cliente ?? null;
  const clienteId = clienteDelViaje?.id ?? null;

  function applyTransportistaUpdate(updated: Cliente | Transportista) {
    const t = updated as Transportista;
    setDetail((prev) => {
      const base = prev ?? liq;
      return {
        ...base,
        transportista: {
          id: t.id,
          nombre: t.nombre,
          idFiscal: t.idFiscal,
          domicilio: t.domicilio,
          condicionIva: t.condicionIva,
          pais: t.pais,
          condicionTributaria: t.condicionTributaria,
        },
      };
    });
    onDataSaved?.();
  }

  function applyClienteUpdate(updated: Cliente | Transportista) {
    const c = updated as Cliente;
    setDetail((prev) => {
      const base = prev ?? liq;
      const viajes = base.viajes;
      if (!viajes || viajes.length === 0) return base;
      const nextViajes = viajes.map((v, i) =>
        i === 0 && v.viaje
          ? {
              ...v,
              viaje: {
                ...v.viaje,
                cliente: {
                  id: c.id,
                  nombre: c.nombre,
                  idFiscal: c.idFiscal,
                  direccion: c.direccion,
                  pais: c.pais,
                  condicionIva: c.condicionIva,
                  condicionTributaria: c.condicionTributaria,
                },
              },
            }
          : v,
      );
      return { ...base, viajes: nextViajes };
    });
    onDataSaved?.();
  }

  const ptoVentaNum = Number(ptoVenta);
  const ptoVentaInvalido =
    !ptoVenta.trim() || !Number.isInteger(ptoVentaNum) || ptoVentaNum < 1;
  const cvlpClaseBAlerta =
    source.cbteTipo === 60 &&
    cvlpClaseBEsperada(source.transportista?.condicionIva);

  async function confirmar() {
    if (datosEmitIncompletos) {
      setError(missingEmitMessage);
      return;
    }
    if (cvlpClaseBAlerta) {
      setError(
        "No se puede emitir: la condición frente al IVA del transportista no corresponde a CVLP 060.",
      );
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
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
              Emitir comprobante
            </h2>
            <AmbienteTestBadge ambiente={arcaConfig?.ambiente} />
          </div>
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
            {missingTransportistaFields.length > 0 && (
              <div className="mt-2 rounded border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
                <p className="font-medium">
                  Faltan datos del transportista: {missingTransportistaFields.map(f => f.replace("Transportista: ", "")).join(", ")}.
                  <br />
                  <strong className="font-bold">Desplazate hacia abajo para completarlos.</strong>
                </p>
              </div>
            )}
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
            {missingClienteFields.length > 0 && (
              <div className="mt-2 rounded border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
                <p className="font-medium">
                  Faltan datos del cliente: {missingClienteFields.map(f => f.replace("Cliente: ", "")).join(", ")}.
                  <br />
                  <strong className="font-bold">Desplazate hacia abajo para completarlos.</strong>
                </p>
              </div>
            )}
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

          {missingEmisorFields.length > 0 && (
            <div
              className="rounded border border-amber-400/40 bg-amber-50 px-4 py-3 text-xs text-amber-900"
              role="alert"
            >
              <p className="font-medium">
                Completá estos datos antes de emitir
              </p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {missingEmisorFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {missingTransportistaFields.length > 0 && transportistaId && (
            <CompletarDatosFiscalesInline
              entidad="transportista"
              id={transportistaId}
              tenantId={tenantId}
              getToken={getToken}
              initial={{
                nombre: source.transportista?.nombre ?? liq.transportista?.nombre ?? "",
                pais: source.transportista?.pais ?? null,
                idFiscal: source.transportista?.idFiscal ?? null,
                condicionIva: source.transportista?.condicionIva ?? null,
                condicionTributaria: source.transportista?.condicionTributaria ?? null,
                direccion: source.transportista?.domicilio ?? null,
              }}
              onSaved={applyTransportistaUpdate}
            />
          )}

          {missingClienteFields.length > 0 && clienteId && (
            <CompletarDatosFiscalesInline
              entidad="cliente"
              id={clienteId}
              tenantId={tenantId}
              getToken={getToken}
              initial={{
                nombre: clienteDelViaje?.nombre ?? "",
                pais: clienteDelViaje?.pais ?? null,
                idFiscal: clienteDelViaje?.idFiscal ?? null,
                condicionIva: clienteDelViaje?.condicionIva ?? null,
                condicionTributaria: clienteDelViaje?.condicionTributaria ?? null,
                direccion: clienteDelViaje?.direccion ?? null,
              }}
              onSaved={applyClienteUpdate}
            />
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

          {cvlpClaseBAlerta && (
            <div
              className="rounded border border-red-300/60 bg-red-50 px-4 py-3 text-xs text-red-900"
              role="alert"
            >
              <p className="font-medium">No corresponde emitir CVLP 060</p>
              <p className="mt-1">
                Condición frente al IVA del transportista:{" "}
                <span className="font-medium">
                  {condicionIvaLabel(source.transportista?.condicionIva)}
                </span>
                . {CVLP_CLASE_B_WARNING}
              </p>
            </div>
          )}
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
              ptoVentaInvalido ||
              cvlpClaseBAlerta
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
