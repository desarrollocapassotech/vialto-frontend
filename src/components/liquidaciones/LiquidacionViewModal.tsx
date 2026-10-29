import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Ban, FileDown, FileText, Paperclip, Receipt, RotateCw, Trash2 } from "lucide-react";
import {
  anulacionComprobanteLabel,
  liquidacionConArca,
  nroComprobante,
} from "@/lib/arcaCbteTipo";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  idPropio2Habilitado as idPropio2HabilitadoTenant,
  idPropio2Label as idPropio2LabelTenant,
} from "@/lib/viajesFlota";
import {
  Dato,
  DatosCabecera,
  DetalleMontosCard,
  ViajesDetalleLista,
} from "@/components/shared/DetalleComprobante";
import { usuarioLabel } from "@/lib/usuarioLabel";
import { LiquidacionPagoBadge } from "./LiquidacionPagoBadge";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { LiquidacionMontosBreakdown } from "@/components/liquidaciones/LiquidacionMontosBreakdown";
import { fmtSignedLiquidacionMoney } from "@/lib/liquidacionMoney";
import { ArcaErrorMessage } from "@/components/ui/ArcaErrorMessage";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { ViajeViewModal } from "@/components/viajes/ViajeViewModal";
import { apiFetch, apiJson } from "@/lib/api";
import { useAbrirAdjunto } from "@/hooks/useAbrirAdjunto";
import { formatStoredArcaError } from "@/lib/arcaFriendlyError";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
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
  return fmtDateUtc(iso);
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fmtDate(iso);
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      detalle: row.detalle ?? null,
    };
  });
}

export function LiquidacionViewModal({
  liq,
  ivaPct,
  canEdit = true,
  hasArca: hasArcaTenant = false,
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
  onAdjuntarComprobante,
  onVerPdfLiquidacion,
  onVerAnulacion,
  onVerComprobanteAnulacionManual,
  onVolverAEmitir,
  idPropio2Habilitado: idPropio2HabilitadoProp,
  idPropio2Label: idPropio2LabelProp,
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
  /** Sin ARCA: botón "Adjuntar comprobante" si la liquidación todavía no tiene archivo. */
  onAdjuntarComprobante?: () => void;
  /**
   * Sin ARCA: "PDF de liquidación" (resumen que genera Vialto), distinto de "Ver comprobante"
   * (el adjunto manual). Con ARCA no se muestra: el comprobante ya es el PDF del CVLP.
   */
  onVerPdfLiquidacion?: () => void;
  /** Ver el PDF de la Nota de Crédito/Débito de anulación. Solo tiene sentido si `estado === 'anulado'` y anulacionMetodo = 'nota_credito_debito'. */
  onVerAnulacion?: () => void;
  /** Ver el comprobante pre-impreso adjunto en la anulación manual. Solo si `anulacionMetodo === 'manual'`. */
  onVerComprobanteAnulacionManual?: () => void;
  /**
   * Liquidación anulada: abre "Nueva liquidación" precargada con sus datos. Sin handler, el
   * botón navega a Liquidaciones con `volverAEmitirLiquidacionId` y la pantalla lo resuelve.
   */
  onVolverAEmitir?: () => void;
  /**
   * true = el tenant habilitó "ID Propio 2" — se muestra junto a cada viaje incluido.
   * Sin prop se toma la configuración de la empresa propia.
   */
  idPropio2Habilitado?: boolean;
  /** Label configurable de "ID Propio 2". Sin prop, el de la empresa propia. */
  idPropio2Label?: string;
}) {
  // Liquidación manual (monotributista) en empresa con ARCA: se muestra como sin ARCA.
  const hasArca = liquidacionConArca(hasArcaTenant, liq);
  const { tenant: tenantPropio } = useCurrentTenant();
  const mostrarIdPropio2 = idPropio2HabilitadoProp ?? idPropio2HabilitadoTenant(tenantPropio);
  const labelIdPropio2 = idPropio2LabelProp ?? idPropio2LabelTenant(tenantPropio);
  const { getToken: getAuthToken } = useAuth();
  const { abrirAdjunto, visorAdjunto } = useAbrirAdjunto();
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
  // Sin handler de la pantalla (ej. abierto desde Viajes o Cuenta corriente), el modal abre el
  // comprobante de anulación por su cuenta.
  const verAnulacion = anulada
    ? anulacionManual
      ? source.anulacionManualComprobanteUrl?.trim()
        ? {
            label: "Ver comprobante de anulación",
            onClick:
              onVerComprobanteAnulacionManual ??
              (() =>
                abrirAdjunto(
                  { url: source.anulacionManualComprobanteUrl!.trim() },
                  "Comprobante de anulación",
                )),
          }
        : undefined
      : source.anulacionCae
        ? {
            label: `Ver ${anulacionNcNd!.toLowerCase()}`,
            onClick: onVerAnulacion ?? (() => void verPdfAnulacionPorDefecto()),
          }
        : undefined
    : undefined;

  /** PDF de la NC/ND de anulación en pestaña nueva (lo genera el backend). */
  async function verPdfAnulacionPorDefecto() {
    // La pestaña se abre en el click (si no, el navegador la bloquea como popup).
    const ventana = window.open("", "_blank");
    try {
      const qs = tenantIdUrl ? `?tenantId=${encodeURIComponent(tenantIdUrl)}` : "";
      const res = await apiFetch(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/pdf-anulacion${qs}`,
        () => getAuthToken(),
      );
      if (!res.ok) throw new Error("No se pudo generar el PDF de la anulación.");
      const blobUrl = URL.createObjectURL(await res.blob());
      if (ventana) ventana.location.href = blobUrl;
      else window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      ventana?.close();
      showToast(friendlyError(e, "arca"), "error");
    }
  }
  // Viajes que componen el bruto: se ven al desplegar la fila "Bruto" del detalle.
  const viajesDetalle = (
    <ViajesDetalleLista
      items={viajesIncluidos.map((row) => {
        const v = row.viaje;
        return {
          key: row.viajeId,
          viajeId: v?.id ?? row.viajeId,
          numero: String(v?.numeroIdentificacionPersonalizado?.trim() || v?.numero || "—"),
          fechaCarga: v?.fechaCarga,
          origen: v?.origen,
          destino: v?.destino,
          extra:
            mostrarIdPropio2 && v?.idPropio2?.trim()
              ? `${labelIdPropio2}: ${v.idPropio2.trim()}`
              : null,
          importe: fmtSignedLiquidacionMoney(Number(row.subtotal) || 0, "plus"),
        };
      })}
      vacio={cantViajes > 0 ? "Sin detalle disponible." : "Sin viajes asociados."}
      loadingViajeId={loadingViajeId}
      onVerViaje={(id) => void handleVerViaje(id)}
      fmtFecha={fmtDate}
    />
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
  // Manual (monotributista): queda en borrador pero ya está liquidada.
  const estadoBadge =
    liq.manual && source.estado === "borrador" ? "autorizado" : source.estado;

  return (
    <>
      <ViewModalShell
        title={
          <span className="inline-flex items-center gap-3">
            <span>Detalle de liquidación</span>
            <span
              className={[
                "text-xs font-medium border rounded px-2 py-0.5",
                ESTADO_BADGE[estadoBadge],
              ].join(" ")}
            >
              {ESTADO_LABEL[estadoBadge]}
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
            {onVerPdfLiquidacion && !hasArca && (
              <button
                type="button"
                onClick={onVerPdfLiquidacion}
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
              >
                <FileDown className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                PDF de liquidación
              </button>
            )}
            {onAdjuntarComprobante && !hasArca && !source.comprobanteUrl?.trim() && (
              <button
                type="button"
                onClick={onAdjuntarComprobante}
                className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
              >
                <Paperclip className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                Adjuntar comprobante
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
          <DatosCabecera>
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
                    ? `N° ${nroComprobante(source.ptoVenta, source.cbteNro)}`
                    : undefined
                }
              />
            ) : (
              source.numeroComprobanteProveedor && (
                <Dato
                  label="Número de comprobante"
                  value={source.numeroComprobanteProveedor}
                  sub={
                    source.proveedorCbteFecha
                      ? `Fecha ${fmtDate(source.proveedorCbteFecha)}`
                      : undefined
                  }
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
                    value={`N° ${nroComprobante(source.anulacionPtoVenta, source.anulacionCbteNro)}`}
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
          </DatosCabecera>

          <DetalleMontosCard loading={loadingDetail}>
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
          </DetalleMontosCard>

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
      {visorAdjunto}
    </>
  );
}
