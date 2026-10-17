import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Ban, FileText, Receipt, RotateCw, Trash2 } from "lucide-react";
import { anulacionComprobanteLabel } from "@/lib/arcaCbteTipo";
import { usuarioLabel } from "@/lib/usuarioLabel";
import { LiquidacionPagoBadge } from "./LiquidacionPagoBadge";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { LiquidacionMontosBreakdown } from "@/components/liquidaciones/LiquidacionMontosBreakdown";
import { fmtSignedLiquidacionMoney } from "@/lib/liquidacionMoney";
import { Spinner } from "@/components/ui/Spinner";
import { ArcaErrorMessage } from "@/components/ui/ArcaErrorMessage";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { ViajeViewModal } from "@/components/viajes/ViajeViewModal";
import { apiJson } from "@/lib/api";
import { formatStoredArcaError } from "@/lib/arcaFriendlyError";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import type {
  Liquidacion,
  LiquidacionConceptoLinea,
  LiquidacionEstado,
  LiquidacionViajeItem,
  Viaje,
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

/** Dato compacto del bloque de cabecera: etiqueta chica, valor y una línea secundaria opcional. */
function Dato({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string | number | null | undefined;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
        {label}
      </p>
      <p className="truncate text-sm font-medium text-vialto-charcoal" title={String(value ?? "")}>
        {value ?? "—"}
      </p>
      {sub && <p className="truncate text-xs text-vialto-steel">{sub}</p>}
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
      cantidad: Number(row.cantidad) || 1,
      montoUnitario: row.montoUnitario != null ? Number(row.montoUnitario) : null,
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
  onVolverAEmitir,
  idPropio2Habilitado = false,
  idPropio2Label = "ID Propio 2",
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
  /**
   * Liquidación anulada: abre "Nueva liquidación" precargada con sus datos. Sin handler, el
   * botón navega a Liquidaciones con `volverAEmitirLiquidacionId` y la pantalla lo resuelve.
   */
  onVolverAEmitir?: () => void;
  /** true = el tenant habilitó "ID Propio 2" — se muestra junto a cada viaje incluido. */
  idPropio2Habilitado?: boolean;
  /** Label configurable de "ID Propio 2". */
  idPropio2Label?: string;
}) {
  const { getToken: getAuthToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantIdUrl = searchParams.get("tenantId")?.trim() ?? "";
  const { showToast } = useToast();
  const [detail, setDetail] = useState<LiquidacionConTransportista>(liq);
  const [loadingDetail, setLoadingDetail] = useState(Boolean(getToken));
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
  const [loadingViajeId, setLoadingViajeId] = useState<string | null>(null);

  async function handleVerViaje(viajeId: string) {
    setLoadingViajeId(viajeId);
    try {
      const viaje = await apiJson<Viaje>(
        `/api/viajes/${encodeURIComponent(viajeId)}`,
        () => getAuthToken(),
      );
      setViewingViaje(viaje);
    } catch (e) {
      showToast(friendlyError(e, "viajes"), "error");
    } finally {
      setLoadingViajeId(null);
    }
  }

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

  // Si el caller actualiza `liq` con datos frescos (ej. tras emitir/anular/marcar
  // pendiente/confirmar anulación) sin cerrar el modal, reflejarlo de inmediato — el
  // efecto de arriba solo dispara por cambio de `liq.id`, no por cambios de contenido.
  useEffect(() => {
    setDetail((prev) => ({
      ...prev,
      ...liq,
      conceptosLineas: liq.conceptosLineas?.length
        ? normalizeConceptosLineas(liq.conceptosLineas)
        : prev.conceptosLineas,
      viajes: liq.viajes?.length ? liq.viajes : prev.viajes,
    }));
  }, [liq]);

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
  const cantViajes = viajesIncluidos.length || source.cantViajes || 0;
  const anulada = source.estado === "anulado";
  const anulacionManual = source.anulacionMetodo === "manual";
  /** "Nota de Crédito"/"Nota de Débito" si se anuló con comprobante ARCA; null si fue manual. */
  const anulacionNcNd =
    anulada && !anulacionManual
      ? anulacionComprobanteLabel(source.anulacionCbteTipo)
      : null;
  // Botones de comprobantes del pie: con anulación se distingue el original del de anulación.
  const verAnulacion = anulada
    ? anulacionManual
      ? onVerComprobanteAnulacionManual && {
          label: "Ver comprobante de anulación",
          onClick: onVerComprobanteAnulacionManual,
        }
      : onVerAnulacion && {
          label: `Ver ${anulacionNcNd!.toLowerCase()}`,
          onClick: onVerAnulacion,
        }
    : undefined;
  // Viajes que componen el bruto: se ven al desplegar la fila "Bruto" del detalle.
  const viajesDetalle =
    viajesIncluidos.length === 0 ? (
      <p className="px-2 text-xs text-vialto-steel">
        {cantViajes > 0 ? "Sin detalle disponible." : "Sin viajes asociados."}
      </p>
    ) : (
      // Sin recuadro propio: el importe de cada viaje queda alineado con los demás montos.
      <div className="max-h-52 overflow-y-auto divide-y divide-black/5">
        {viajesIncluidos.map((row) => {
          const v = row.viaje;
          const viajeId = v?.id ?? row.viajeId;
          const numero =
            v?.numeroIdentificacionPersonalizado?.trim() || v?.numero || "—";
          return (
            <button
              key={row.viajeId}
              type="button"
              disabled={loadingViajeId === viajeId}
              onClick={() => void handleVerViaje(viajeId)}
              className="flex w-full items-baseline justify-between gap-4 py-1.5 pl-5 text-left hover:bg-vialto-mist/40 focus:outline-none focus-visible:bg-vialto-mist disabled:opacity-60 disabled:cursor-wait"
            >
              <span className="min-w-0">
                <span className="block text-xs text-vialto-charcoal">
                  Viaje #{numero}
                  {v?.fechaCarga && (
                    <span className="ml-1.5 text-vialto-steel">
                      {fmtDate(v.fechaCarga)}
                    </span>
                  )}
                </span>
                {(v?.origen || v?.destino) && (
                  <span className="block truncate text-[11px] text-vialto-steel">
                    {v?.origen ?? "—"} → {v?.destino ?? "—"}
                  </span>
                )}
                {idPropio2Habilitado && v?.idPropio2?.trim() && (
                  <span className="block text-[11px] text-vialto-steel">
                    {idPropio2Label}: {v.idPropio2.trim()}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-vialto-charcoal">
                {fmtSignedLiquidacionMoney(Number(row.subtotal) || 0, "plus")}
              </span>
            </button>
          );
        })}
      </div>
    );
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
    <>
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
            <LiquidacionPagoBadge estadoPago={source.estadoPago} />
            <AmbienteTestBadge ambiente={source.ambiente} />
          </span>
        }
        onClose={onClose}
        scrollBody
        maxWidthClass="sm:max-w-4xl"
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className={viewModalBtnGhost}
            >
              Cerrar
            </button>
            {onVerComprobante && (
              <button
                type="button"
                onClick={onVerComprobante}
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
              >
                <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {verAnulacion ? "Ver comprobante original" : "Ver comprobante"}
              </button>
            )}
            {verAnulacion && (
              <button
                type="button"
                onClick={verAnulacion.onClick}
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
              >
                <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {verAnulacion.label}
              </button>
            )}
            {hasArca &&
              onEmitir &&
              (source.estado === "borrador" || source.estado === "error") && (
                <button
                  type="button"
                  onClick={onEmitir}
                  className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                >
                  {source.estado === "error" ? (
                    <RotateCw
                      className="h-4 w-4 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  ) : (
                    <Receipt
                      className="h-4 w-4 shrink-0"
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
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-red-300 text-xs uppercase tracking-wider text-red-800 hover:bg-red-50"
              >
                <Trash2
                  className="h-4 w-4 shrink-0"
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
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-red-300 text-xs uppercase tracking-wider text-red-800 hover:bg-red-50"
              >
                <Ban
                  className="h-4 w-4 shrink-0"
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
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-amber-300 text-xs uppercase tracking-wider text-amber-800 hover:bg-amber-50"
              >
                <Ban
                  className="h-4 w-4 shrink-0"
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
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-red-300 text-xs uppercase tracking-wider text-red-800 hover:bg-red-50"
              >
                <Ban
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden
                />
                Confirmar anulación
              </button>
            )}
            {source.estado === "anulado" && (
              <button
                type="button"
                onClick={
                  onVolverAEmitir ??
                  // Abierto desde otra pantalla (Viajes, Cuenta corriente): se va a
                  // Liquidaciones, que abre "Nueva liquidación" precargada con esta.
                  // Superadmin: la empresa viene en `?tenantId=` y Liquidaciones la lee de ahí.
                  (() =>
                    navigate(
                      tenantIdUrl
                        ? `/liquidaciones?tenantId=${encodeURIComponent(tenantIdUrl)}`
                        : "/liquidaciones",
                      { state: { volverAEmitirLiquidacionId: liq.id } },
                    ))
                }
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
              >
                <RotateCw
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden
                />
                Volver a emitir
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
          {/* Datos de cabecera (destinatario, comprobante, período, CAE…) en un bloque compacto. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border border-black/10 bg-vialto-mist/60 px-4 py-3 sm:grid-cols-3">
            <Dato
              label="Destinatario"
              value={transportistaNombre}
              sub={
                source.transportista?.idFiscal
                  ? `CUIT ${source.transportista.idFiscal}`
                  : undefined
              }
              className="col-span-2 sm:col-span-1"
            />
            {hasArca ? (
              <Dato
                label="Comprobante"
                value={CBTE_TIPO[source.cbteTipo] ?? `Tipo ${source.cbteTipo}`}
                sub={
                  source.cbteNro != null
                    ? `N° ${String(source.ptoVenta ?? 0).padStart(4, "0")}-${String(source.cbteNro).padStart(8, "0")}`
                    : undefined
                }
              />
            ) : (
              source.numeroComprobanteProveedor && (
                <Dato
                  label="N° de factura del proveedor"
                  value={source.numeroComprobanteProveedor}
                />
              )
            )}
            <Dato
              label="Período"
              value={`${fmtDate(source.periodoDesde)} — ${fmtDate(source.periodoHasta)}`}
            />
            {source.cae && (
              <Dato
                label="CAE"
                value={source.cae}
                sub={
                  source.caeFechaVto
                    ? `Vto. ${fmtDate(source.caeFechaVto)}`
                    : undefined
                }
              />
            )}
            <Dato
              label="Creada"
              value={fmtDate(source.createdAt)}
              sub={
                source.ambiente
                  ? source.ambiente === "homologacion"
                    ? "Homologación (prueba)"
                    : "Producción"
                  : undefined
              }
            />
            {source.proveedorContrato && (
              <Dato label="Proveedor contrato" value={source.proveedorContrato} />
            )}
            {anulada && (
              <>
                <Dato
                  label="Anulada"
                  value={fmtDateTime(source.anuladoAt)}
                  sub={`Por ${usuarioLabel(source.anuladoPorNombre, source.anuladoPor)}`}
                />
                {anulacionNcNd && source.anulacionCbteNro != null && (
                  <Dato
                    label={anulacionNcNd}
                    value={`N° ${String(source.anulacionPtoVenta ?? 0).padStart(4, "0")}-${String(source.anulacionCbteNro).padStart(8, "0")}`}
                    sub={source.anulacionCae ? `CAE ${source.anulacionCae}` : undefined}
                  />
                )}
                <Dato
                  label="Motivo de anulación"
                  value={source.motivoAnulacion}
                  className="col-span-2 sm:col-span-1"
                />
              </>
            )}
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
                  brutoDetalleResumen={
                    cantViajes > 0
                      ? `${cantViajes} viaje${cantViajes === 1 ? "" : "s"}`
                      : undefined
                  }
                  brutoDetalle={viajesDetalle}
                />
              )}
            </div>
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
        </div>
      </ViewModalShell>
      {viewingViaje && (
        <ViajeViewModal
          viaje={viewingViaje}
          onClose={() => setViewingViaje(null)}
          onEditar={() => {
            const viajeId = viewingViaje.id;
            setViewingViaje(null);
            onClose();
            navigate(`/viajes?viaje=${encodeURIComponent(viajeId)}`);
          }}
        />
      )}
    </>
  );
}
