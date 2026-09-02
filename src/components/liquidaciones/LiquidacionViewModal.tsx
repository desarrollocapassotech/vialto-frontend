import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, RotateCw, Trash2 } from "lucide-react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import {
  fmtLiquidacionMoney,
  LiquidacionMontosBreakdown,
} from "@/components/liquidaciones/LiquidacionMontosBreakdown";
import { Spinner } from "@/components/ui/Spinner";
import { ArcaErrorMessage } from "@/components/ui/ArcaErrorMessage";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { apiJson } from "@/lib/api";
import { formatStoredArcaError } from "@/lib/arcaFriendlyError";
import type {
  Liquidacion,
  LiquidacionConceptoLinea,
  LiquidacionEstado,
  LiquidacionViajeItem,
} from "@/types/api";

export type LiquidacionConTransportista = Liquidacion & {
  transportista?: {
    id: string;
    nombre: string;
    idFiscal: string | null;
  } | null;
};

const ESTADO_LABEL: Record<LiquidacionEstado, string> = {
  borrador: "BORRADOR",
  pendiente_cae: "ESPERANDO AFIP",
  autorizado: "LIQUIDADO",
  error: "ERROR DE AFIP",
  anulado: "ANULADO",
  pendiente_anulacion: "PENDIENTE DE ANULACIÓN",
};

const ESTADO_BADGE: Record<LiquidacionEstado, string> = {
  borrador: "bg-gray-100 text-gray-700 border-gray-300/80",
  pendiente_cae: "bg-amber-100 text-amber-800 border-amber-300/80",
  autorizado: "bg-emerald-100 text-emerald-800 border-emerald-400/80",
  error: "bg-red-100 text-red-800 border-red-300/80",
  anulado: "bg-gray-100 text-gray-500 border-gray-300/80",
  pendiente_anulacion: "bg-amber-100 text-amber-800 border-amber-300/80",
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

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fmtDate(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  return raw.map((l, i): LiquidacionConceptoLinea => {
    const row = l as LiquidacionConceptoLinea & { nombre?: string };
    const signo: LiquidacionConceptoLinea["signo"] =
      String(row.signo ?? "").toLowerCase() === "contra" ? "contra" : "favor";
    return {
      id: row.id || `linea-${i}`,
      nombreSnapshot: row.nombreSnapshot || row.nombre || "Concepto",
      signo,
      monto: Number(row.monto) || 0,
      // null = usar el IVA de la liquidación; 0 = exento (no confundir).
      ivaPct: row.ivaPct != null ? Number(row.ivaPct) : null,
      orden: row.orden ?? i,
      conceptoLiquidacionId: row.conceptoLiquidacionId ?? null,
      modoAplicacion: row.modoAplicacion ?? "GENERAL",
      viajeId: row.viajeId ?? null,
    };
  });
}

export function LiquidacionViewModal({
  liq,
  ivaPct,
  canEdit = true,
  hasArca = false,
  metodoAnulacion = "nota_credito_debito",
  getToken,
  detalleUrl,
  onClose,
  onEditar,
  onEmitir,
  onEliminar,
  onAnular,
  onMarcarPendienteAnulacion,
  onConfirmarAnulacionManual,
  onVerComprobante,
  onVerAnulacion,
  onVerComprobanteAnulacionManual,
}: {
  liq: LiquidacionConTransportista;
  ivaPct?: number;
  canEdit?: boolean;
  /** Tenant con integración ARCA: habilita el botón de emitir/reintentar. */
  hasArca?: boolean;
  /** Tenant.liquidacionAnulacionMetodo — decide qué acción de anulación mostrar. */
  metodoAnulacion?: "nota_credito_debito" | "manual";
  /** Si se pasa, el modal refetch el detalle (incluye conceptosLineas). */
  getToken?: () => Promise<string | null>;
  detalleUrl?: string;
  onClose: () => void;
  onEditar: () => void;
  /** Si se pasa, muestra "Emitir"/"Reintentar emisión" cuando el estado es borrador o error. */
  onEmitir?: () => void;
  /** Baja de borrador (o error / esperando AFIP). El caller pide confirmación. */
  onEliminar?: () => void;
  /** Anulación de liquidación autorizada vía NC/ND (ARCA). Solo con metodoAnulacion = 'nota_credito_debito'. */
  onAnular?: () => void;
  /** Anulación manual paso 1: marca pendiente_anulacion, sin ARCA. Solo con metodoAnulacion = 'manual'. */
  onMarcarPendienteAnulacion?: () => void;
  /** Anulación manual paso 2: confirma con comprobante pre-impreso adjunto. */
  onConfirmarAnulacionManual?: () => void;
  /** Ver el comprobante: PDF del CVLP autorizado (ARCA) o adjunto manual (sin ARCA), según lo resuelva el caller. */
  onVerComprobante?: () => void;
  /** Ver el PDF de la Nota de Crédito/Débito de anulación. Solo tiene sentido si `estado === 'anulado'` y anulacionMetodo = 'nota_credito_debito'. */
  onVerAnulacion?: () => void;
  /** Ver el comprobante pre-impreso adjunto en la anulación manual. Solo si `anulacionMetodo === 'manual'`. */
  onVerComprobanteAnulacionManual?: () => void;
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
  const ivaPctEfectivo = (() => {
    const raw = ivaPct ?? source.ivaPct ?? null;
    if (raw == null) return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  })();
  const conceptosLineas = normalizeConceptosLineas(source.conceptosLineas);
  const viajesIncluidos: LiquidacionViajeItem[] = source.viajes ?? [];
  const puedeEliminar =
    Boolean(onEliminar) &&
    (source.estado === "borrador" ||
      source.estado === "error" ||
      source.estado === "pendiente_cae");
  const puedeAnular =
    Boolean(onAnular) &&
    hasArca &&
    source.estado === "autorizado" &&
    metodoAnulacion !== "manual";
  const puedeMarcarPendienteAnulacion =
    Boolean(onMarcarPendienteAnulacion) &&
    hasArca &&
    source.estado === "autorizado" &&
    metodoAnulacion === "manual";
  const puedeConfirmarAnulacionManual =
    Boolean(onConfirmarAnulacionManual) &&
    hasArca &&
    source.estado === "pendiente_anulacion";

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
          <AmbienteTestBadge ambiente={source.ambiente} />
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
          {hasArca &&
            onEmitir &&
            (source.estado === "borrador" || source.estado === "error") && (
              <button
                type="button"
                onClick={onEmitir}
                className={`inline-flex items-center gap-1.5 ${viewModalBtnPrimary}`}
              >
                {source.estado === "error" && (
                  <RotateCw
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                )}
                {source.estado === "error" ? "Reintentar emisión" : "Emitir"}
              </button>
            )}
          {puedeEliminar && (
            <button
              type="button"
              onClick={onEliminar}
              className="inline-flex min-h-11 items-center gap-1.5 border border-red-300 px-3 text-xs uppercase tracking-wider text-red-800 hover:bg-red-50"
            >
              <Trash2
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              Eliminar
            </button>
          )}
          {puedeAnular && (
            <button
              type="button"
              onClick={onAnular}
              className="inline-flex min-h-11 items-center gap-1.5 border border-red-300 px-3 text-xs uppercase tracking-wider text-red-800 hover:bg-red-50"
            >
              <Ban
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              Anular
            </button>
          )}
          {puedeMarcarPendienteAnulacion && (
            <button
              type="button"
              onClick={onMarcarPendienteAnulacion}
              className="inline-flex min-h-11 items-center gap-1.5 border border-amber-300 px-3 text-xs uppercase tracking-wider text-amber-800 hover:bg-amber-50"
            >
              <Ban
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              Marcar pendiente de anulación
            </button>
          )}
          {puedeConfirmarAnulacionManual && (
            <button
              type="button"
              onClick={onConfirmarAnulacionManual}
              className="inline-flex min-h-11 items-center gap-1.5 border border-red-300 px-3 text-xs uppercase tracking-wider text-red-800 hover:bg-red-50"
            >
              <Ban
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              Confirmar anulación
            </button>
          )}
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

        <div>
          <p className="mb-2 text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.2em] text-vialto-steel">
            Viajes ({viajesIncluidos.length || source.cantViajes})
          </p>
          {loadingDetail ? (
            <div className="flex justify-center rounded border border-black/10 py-6">
              <Spinner className="h-5 w-5" />
            </div>
          ) : viajesIncluidos.length === 0 ? (
            <p className="rounded border border-black/10 bg-white px-4 py-3 text-sm text-vialto-steel">
              {source.cantViajes > 0
                ? `${source.cantViajes} viaje${source.cantViajes === 1 ? "" : "s"} (sin detalle disponible).`
                : "Sin viajes asociados."}
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded border border-black/10 divide-y divide-black/5 bg-white">
              {viajesIncluidos.map((row) => {
                const v = row.viaje;
                const viajeId = v?.id ?? row.viajeId;
                const numero =
                  v?.numeroIdentificacionPersonalizado?.trim() ||
                  v?.numero ||
                  "—";
                return (
                  <Link
                    key={row.viajeId}
                    to={`/viajes?viaje=${encodeURIComponent(viajeId)}`}
                    onClick={onClose}
                    className="block px-3 py-2.5 hover:bg-vialto-mist/60 focus:outline-none focus-visible:bg-vialto-mist"
                  >
                    <p className="text-xs font-medium text-vialto-charcoal">
                      Viaje #{numero}
                      {v?.fechaCarga && (
                        <span className="ml-1.5 font-normal text-vialto-steel">
                          {fmtDate(v.fechaCarga)}
                        </span>
                      )}
                    </p>
                    {(v?.origen || v?.destino) && (
                      <p className="text-[11px] text-vialto-steel truncate">
                        {v?.origen ?? "—"} → {v?.destino ?? "—"}
                      </p>
                    )}
                    <p className="text-[11px] text-vialto-charcoal tabular-nums">
                      {fmtLiquidacionMoney(Number(row.subtotal) || 0)}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className={viewModalGridClass}>
          <Campo
            label="Período"
            value={`${fmtDate(source.periodoDesde)} — ${fmtDate(source.periodoHasta)}`}
          />
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
          {source.ambiente && (
            <Campo
              label="Ambiente"
              value={
                source.ambiente === "homologacion"
                  ? "Homologación (prueba)"
                  : "Producción"
              }
            />
          )}
          <Campo label="Creada" value={fmtDate(source.createdAt)} />
        </div>

        {source.estado === "pendiente_anulacion" && (
          <div>
            <p className="mb-2 text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.2em] text-vialto-steel">
              Anulación
            </p>
            <div className="rounded border border-amber-300/80 bg-amber-50 px-4 py-3 space-y-1">
              <p className="text-sm text-amber-900">
                Marcada como pendiente de anulación
                {source.anulacionPendienteDesde
                  ? ` el ${fmtDateTime(source.anulacionPendienteDesde)}`
                  : ""}
                . Falta adjuntar el comprobante pre-impreso para confirmarla.
              </p>
            </div>
          </div>
        )}

        {source.estado === "anulado" && (
          <div>
            <p className="mb-2 text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.2em] text-vialto-steel">
              Anulación
            </p>
            <div className="rounded border border-black/10 bg-vialto-mist px-4 py-3 space-y-2">
              <Campo label="Motivo" value={source.motivoAnulacion} />
              <div className={viewModalGridClass}>
                <Campo label="Anulada el" value={fmtDateTime(source.anuladoAt)} />
                <Campo
                  label="Anulada por"
                  value={source.anuladoPorNombre ?? source.anuladoPor}
                />
              </div>
              {source.anulacionMetodo === "manual"
                ? onVerComprobanteAnulacionManual && (
                    <button
                      type="button"
                      onClick={onVerComprobanteAnulacionManual}
                      className="px-3 py-1.5 text-xs uppercase tracking-wider border border-black/20 hover:bg-vialto-mist"
                    >
                      Ver comprobante de anulación
                    </button>
                  )
                : onVerAnulacion && (
                    <button
                      type="button"
                      onClick={onVerAnulacion}
                      className="px-3 py-1.5 text-xs uppercase tracking-wider border border-black/20 hover:bg-vialto-mist"
                    >
                      Ver anulación
                    </button>
                  )}
            </div>
          </div>
        )}

        {source.arcaError && (
          <div className="rounded px-0 py-0 text-sm">
            <ArcaErrorMessage
              message={
                formatStoredArcaError(source.arcaError) ?? source.arcaError
              }
              detalle={source.arcaErrorDetalle ?? undefined}
            />
          </div>
        )}

        {onVerComprobante && (
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
