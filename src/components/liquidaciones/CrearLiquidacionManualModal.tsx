import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";
import { useEffect, useMemo, useRef, useState } from "react";
import { Receipt, HelpCircle } from "lucide-react";
import {
  DetalleComprobanteEncabezado,
  ResumenTotalesBarra,
  VerDetalleButton,
} from "@/components/facturacion/ResumenDetalleColapsable";
import { labelIvaAlicuota } from "@/components/facturacion/FacturaLineasEditor";
import {
  ConceptosLiquidacionLineasEditor,
  isConceptoLineaCompleta,
  toConceptosLineasPayload,
  validateConceptosLineasDraft,
  type ConceptoLineaDraft,
} from "@/components/liquidaciones/ConceptosLiquidacionLineasEditor";
import {
  fmtLiquidacionMoney,
  fmtSignedLiquidacionMoney,
} from "@/components/liquidaciones/LiquidacionMontosBreakdown";
import {
  ViajeDetallePdfTooltip,
  ViajeSubtotalTooltip,
} from "@/components/liquidaciones/ViajeDetallePdfTooltip";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { EmisorArcaResumen } from "@/components/facturacion/EmisorArcaResumen";
import { ParteFacturaResumen } from "@/components/facturacion/ParteFacturaResumen";
import { DatosFiscalesFaltantesModal } from "@/components/shared/DatosFiscalesFaltantesModal";
import { AvisoFaltantesEmision } from "@/components/shared/AvisoFaltantesEmision";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { BloqueoModal } from "@/components/ui/BloqueoModal";
import { ConfirmarEmisionArcaDialog } from "@/components/shared/ConfirmarEmisionArcaDialog";
import { useZumbidoAviso } from "@/hooks/useZumbidoAviso";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";
import {
  aplicarCambiosPadronCliente,
  aplicarCambiosPadronTransportista,
  useValidacionPadronRegistro,
} from "@/hooks/useValidacionPadronRegistro";
import { useReceptorPadronBloqueado } from "@/hooks/useReceptorPadronBloqueado";
import { useTenantPaisFijo } from "@/hooks/useTenantPaisFijo";
import { unidadCantidadViajes } from "@/lib/pdfDetalleViaje";
import { PadronValidacionEstado } from "@/components/shared/PadronValidacionEstado";
import { ViajesSeleccionTabla } from "@/components/shared/ViajesSeleccionTabla";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson, apiFetch } from "@/lib/api";
import { apiJsonTodasLasPaginas } from "@/lib/listadoPaginacion";
import { collectCvlpEmitMissingFields } from "@/lib/cvlpEmitValidation";
import {
  CVLP_CLASE_B_WARNING,
  condicionIvaLabel,
  cvlpCbteLabel,
  cvlpClaseBEsperada,
  esCondicionIvaMonotributo,
} from "@/lib/arcaCbteTipo";
import {
  MSG_ARCA_NO_LIQUIDA_USD,
  arcaBloqueaLiquidarUsd,
} from "@/lib/arcaUsdRestriction";
import { MSG_EMITIR_MONTO_CERO } from "@/lib/arcaMontoCero";
import { uploadComprobante } from "@/lib/comprobanteUpload";
import {
  normalizeViajeMoneda,
  type ViajeMonedaCodigo,
} from "@/lib/currencyMask";
import { friendlyError } from "@/lib/friendlyError";
import {
  nombreConDetalle,
  signedMontoConIvaConcepto,
  signedMontoNetoConcepto,
} from "@/lib/liquidacionConceptosIva";
import { useToast } from "@/lib/toast";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import {
  formatViajeImporteForListado,
  numeroVisibleViaje,
  transportistaEfectivoIdDesdeViaje,
} from "@/lib/viajesFlota";
import {
  transportistasLiquidacionOpcionesDesdeViaje,
  viajePermiteElegirTransportistaLiquidacion,
  viajeTieneLiquidacionActivaParaTransportista,
  viajeTieneLiquidacionTransportista,
} from "@/lib/viajesComprobantes";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import {
  useHiddenFiscalFields,
  formatMissingFiscalField,
} from "@/hooks/useHiddenFiscalFields";
import type {
  Cliente,
  Liquidacion,
  Transportista,
  Viaje,
  ArcaConfig,
} from "@/types/api";
import { ordenarAlfabetico } from "@/lib/ordenAlfabetico";

type ViajeItem = Pick<
  Viaje,
  | "id"
  | "numero"
  | "numeroIdentificacionPersonalizado"
  | "idPropio2"
  | "fechaCarga"
  | "fechaDescarga"
  | "etapa"
  | "origen"
  | "destino"
  | "precioTransportistaExterno"
  | "monedaPrecioTransportistaExterno"
  | "precioTransportistaIvaIncluidoPct"
  | "cantidadTransportista"
  | "precioUnitarioTransportista"
  | "liquidacionesViaje"
  | "liquidacionEstado"
  | "otrosGastos"
  | "choferId"
  | "chofer"
  | "productosViaje"
  | "cliente"
>;

function fmtDate(iso: string | null | undefined) {
  return fmtDateUtc(iso);
}

/** Valor para `<input type="date">` a partir de un ISO en medianoche UTC, sin corrimiento por zona horaria. */
function dateInputValueFromIso(iso: string | null | undefined): string {
  return iso?.trim() ? iso.slice(0, 10) : "";
}

/** Fila label/importe del resumen — mismo estilo que `Row` de FacturaArcaPreviewPanel. */
function ResumenRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="min-w-0 break-words text-vialto-steel">{label}</span>
      <span className="shrink-0 tabular-nums text-vialto-charcoal">{value}</span>
    </div>
  );
}

function fmtMoney(n: number | null, moneda?: string | null, conMoneda = true) {
  if (n == null) return "—";
  return formatViajeImporteForListado(n, moneda, conMoneda);
}

function monedaViaje(
  v: Pick<ViajeItem, "monedaPrecioTransportistaExterno">,
): ViajeMonedaCodigo {
  return normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);
}

/**
 * IVA de la liquidación precargado desde el viaje (`precioTransportistaIvaIncluidoPct`).
 * Solo si todos los viajes elegidos coinciden y el % es > 0 (0 = el transportista
 * no suma IVA en efectivo, no es “liquidar sin IVA”).
 */
function uniqueIvaPctFromViajes(
  viajes: Pick<ViajeItem, "precioTransportistaIvaIncluidoPct">[],
): number | null {
  const pcts = [
    ...new Set(
      viajes
        .map((v) => Number(v.precioTransportistaIvaIncluidoPct))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  return pcts.length === 1 ? pcts[0] : null;
}

const inputClass =
  "h-9 w-full rounded border border-black/15 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35";
const selectClass = inputClass;
const labelClass =
  "block font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel mb-1";

interface Props {
  /** Viaje puntual: el viaje queda fijo; el transportista solo se elige si hay contratante + ejecutor distintos. */
  viajeInicial?: Viaje;
  /** Liquidación de varios viajes desde la grilla: transportista fijo y viajes preseleccionados (sin `viajeInicial`). */
  transportistaIdInicial?: string;
  viajeIdsIniciales?: string[];
  transportistas: Transportista[];
  /** true = el host todavía está armando la lista de transportistas: bloquea el modal con un loader. */
  transportistasLoading?: boolean;
  config?: ArcaConfig | null;
  /** Tenants con ARCA: tipo CVLP, pto venta y emisión electrónica. Sin ARCA: adjunto manual. */
  hasLiquidoProductoArca: boolean;
  getToken: () => Promise<string | null>;
  onSuccess: (liq: Liquidacion) => void;
  onLiquidacionEmitida?: (liq: Liquidacion) => void;
  onClose: () => void;
  tenantId?: string;
  onDataSaved?: () => void;
  /** true = el tenant muestra la columna/línea dedicada "ID Sistema" (default true). */
  idSistemaHabilitado?: boolean;
  /** true = el tenant muestra la columna/línea dedicada "ID Propio 1" (default true). */
  idPropio1Habilitado?: boolean;
  idPropio1Label?: string;
  /** true = el tenant habilitó "ID Propio 2" — muestra una columna/línea adicional. */
  idPropio2Habilitado?: boolean;
  /** Label configurable de "ID Propio 2". */
  idPropio2Label?: string;
  /** Opciones configuradas de entidades/proveedores para el contrato PDF. */
  opcionesProveedor?: string[];
  /**
   * Liquidación ya guardada (borrador o con error de ARCA) para revisar y emitir: el modal
   * se abre precargado con sus datos y "Emitir" guarda los cambios y la emite. Reemplaza al
   * viejo modal intermedio "Emitir comprobante", así la emisión se ve siempre igual.
   */
  liquidacionExistente?: Liquidacion;
  /**
   * "Volver a emitir" una liquidación anulada: crea una liquidación NUEVA precargada con el
   * transportista, viajes, conceptos, comisión, IVA y período de esta (la anulada no se toca).
   */
  copiaDe?: Liquidacion;
  /** true = pantalla de superadmin con empresa elegida: usa las rutas /api/platform/... */
  rutasPlataforma?: boolean;
}

type LiquidacionDetalleExistente = Liquidacion & {
  transportista?: Partial<Transportista> | null;
  viajes?: Array<{ viajeId?: string; viaje?: { id?: string } | null }>;
};

export function CrearLiquidacionManualModal({
  viajeInicial,
  transportistaIdInicial,
  viajeIdsIniciales,
  transportistas,
  transportistasLoading = false,
  config: configProp,
  hasLiquidoProductoArca,
  getToken,
  onSuccess,
  onLiquidacionEmitida,
  onClose,
  tenantId,
  onDataSaved,
  idSistemaHabilitado = true,
  idPropio1Habilitado = true,
  idPropio1Label = "ID personalizado",
  idPropio2Habilitado = false,
  idPropio2Label = "ID Propio 2",
  opcionesProveedor: opcionesProveedorProp = [],
  liquidacionExistente,
  copiaDe,
  rutasPlataforma = false,
}: Props) {
  const { showToast } = useToast();

  const { solicitarCierre, marcarGuardado, dialogo } = useConfirmarDescarte(onClose);

  const existente = liquidacionExistente ?? null;
  /** De dónde se precargan los datos: la liquidación a emitir o la anulada que se vuelve a emitir. */
  const origen = existente ?? copiaDe ?? null;
  // Una vez que la liquidación entró al circuito de emisión (error de ARCA), sus viajes ya
  // se comunicaron: solo en borrador se pueden agregar/quitar (mismo criterio que la edición).
  const puedeCambiarViajes = !existente || existente.estado === "borrador";
  const plataforma = rutasPlataforma && Boolean(tenantId);
  const arcaBase = plataforma ? "/api/platform/integracion-arca" : "/api/integracion-arca";
  const qsTenant = plataforma ? `?tenantId=${encodeURIComponent(tenantId!)}` : "";

  // El proveedor guardado en la liquidación se ofrece aunque ya no esté en la configuración.
  const opcionesProveedor = useMemo(
    () =>
      origen?.proveedorContrato &&
      !opcionesProveedorProp.includes(origen.proveedorContrato)
        ? [origen.proveedorContrato, ...opcionesProveedorProp]
        : opcionesProveedorProp,
    [origen?.proveedorContrato, opcionesProveedorProp],
  );

  const [resolvedConfig, setResolvedConfig] = useState<ArcaConfig | null>(
    configProp ?? null,
  );
  const [proveedorContrato, setProveedorContrato] = useState<string>(
    origen?.proveedorContrato ??
      (opcionesProveedor && opcionesProveedor.length > 0 ? opcionesProveedor[0] : ""),
  );

  // Detalle completo de la liquidación existente (viajes, conceptos, transportista).
  const [detalleExistente, setDetalleExistente] =
    useState<LiquidacionDetalleExistente | null>(null);

  useEffect(() => {
    if (!opcionesProveedor || opcionesProveedor.length === 0) {
      if (proveedorContrato) setProveedorContrato("");
      return;
    }
    if (!proveedorContrato || !opcionesProveedor.includes(proveedorContrato)) {
      setProveedorContrato(opcionesProveedor[0]);
    }
  }, [opcionesProveedor, proveedorContrato]);

  const transportistaOpcionesViaje = useMemo(
    () =>
      viajeInicial
        ? transportistasLiquidacionOpcionesDesdeViaje(
            viajeInicial,
            transportistas,
          )
        : [],
    [viajeInicial, transportistas],
  );
  const elegirTransportistaEnViaje =
    viajeInicial != null &&
    viajePermiteElegirTransportistaLiquidacion(viajeInicial);

  // — Campos del formulario —
  const [transportistaId, setTransportistaId] = useState(
    () =>
      (origen
        ? origen.transportistaId
        : viajeInicial
          ? transportistaOpcionesViaje[0]?.id
          : transportistaIdInicial) ?? "",
  );
  // Transportista cuyos viajes se preseleccionan al cargar la lista (grilla o liquidación existente/copiada).
  const transportistaIdPreseleccion = origen?.transportistaId ?? transportistaIdInicial;
  /** Viajes a marcar apenas cargue la lista del transportista inicial (una sola vez). */
  const preseleccionPendiente = useRef<string[] | null>(
    !existente && !viajeInicial && transportistaIdInicial && viajeIdsIniciales?.length
      ? viajeIdsIniciales
      : null,
  );

  const [transportistaActualizado, setTransportistaActualizado] =
    useState<Transportista | null>(null);

  const { isVisible, isLoading: isFieldConfigLoading } = useFieldConfig("liquidaciones");
  const showFechaDesde = isVisible("alta_liquidacion", "fechaDesde");
  const showFechaHasta = isVisible("alta_liquidacion", "fechaHasta");

  // Si viene de un viaje puntual, se precargan con su fecha de carga/descarga.
  const [periodoDesde, setPeriodoDesde] = useState(() =>
    dateInputValueFromIso(origen?.periodoDesde ?? viajeInicial?.fechaCarga),
  );
  const [periodoHasta, setPeriodoHasta] = useState(() =>
    dateInputValueFromIso(
      origen?.periodoHasta ?? viajeInicial?.fechaDescarga ?? viajeInicial?.fechaCarga,
    ),
  );
  // Liquidación existente/copiada: comisión e IVA son los guardados (no se recalculan por defecto).
  const [comisionPct, setComisionPct] = useState(() =>
    origen?.comisionPct != null ? String(origen.comisionPct) : "",
  );
  const comisionEditadaManualmente = useRef(Boolean(origen));
  const [ivaPct, setIvaPct] = useState(() => {
    if (origen?.ivaPct != null) return String(origen.ivaPct);
    const fromViaje = uniqueIvaPctFromViajes(
      viajeInicial ? [viajeInicial] : [],
    );
    if (fromViaje != null) return String(fromViaje);
    return configProp?.ivaGastosAdmin != null
      ? String(configProp.ivaGastosAdmin)
      : "";
  });
  const ivaEditadaManualmente = useRef(Boolean(origen));
  const [ptoVenta, setPtoVenta] = useState(
    configProp?.ptoVentaCvlp != null ? String(configProp.ptoVentaCvlp) : "",
  );
  const ptoVentaSyncedFromConfig = useRef(configProp?.ptoVentaCvlp != null);
  const [conceptosLineas, setConceptosLineas] = useState<ConceptoLineaDraft[]>(
    [],
  );
  const [conceptosIncomplete, setConceptosIncomplete] = useState<number[]>([]);

  // — Selección de viajes —
  const [viajes, setViajes] = useState<ViajeItem[]>([]);
  const [viajesLoading, setViajesLoading] = useState(false);
  const [selectedViajeIds, setSelectedViajeIds] = useState<Set<string>>(
    viajeInicial ? new Set([viajeInicial.id]) : new Set(),
  );

  // — Comprobante adjunto (tenants sin ARCA) —
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  // N° de la factura que emitió el proveedor (sin ARCA): es el que muestra Cuenta corriente.
  const [numeroComprobanteProveedor, setNumeroComprobanteProveedor] = useState(
    existente?.numeroComprobanteProveedor ?? "",
  );

  // — Estado del submit / éxito —
  const [step, setStep] = useState<"form" | "autorizada">("form");
  const [liquidacionEmitida, setLiquidacionEmitida] =
    useState<Liquidacion | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [submitAction, setSubmitAction] = useState<
    "borrador" | "emitir" | null
  >(null);
  const submitting = submitAction !== null;
  const [error, setError] = useState<string | null>(null);
  /** Diálogo "¿Emitir la liquidación en ARCA?" antes de emitir. */
  const [confirmarEmision, setConfirmarEmision] = useState(false);

  // Cargar config ARCA si no vino por props
  useEffect(() => {
    if (configProp) {
      setResolvedConfig(configProp);
      return;
    }
    if (!hasLiquidoProductoArca) return;
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await apiJson<ArcaConfig>(
          `${arcaBase}/config${qsTenant}`,
          () => getToken(),
        );
        if (!cancelled) setResolvedConfig(cfg);
      } catch {
        /* validación de emisión / defaults locales alcanzan */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configProp, hasLiquidoProductoArca, getToken, arcaBase, qsTenant]);

  // Liquidación existente o copiada: trae el detalle (viajes y conceptos) para precargar el formulario.
  const origenId = origen?.id;
  useEffect(() => {
    if (!origenId) return;
    let cancelled = false;
    void (async () => {
      let det: LiquidacionDetalleExistente | null = null;
      try {
        det = await apiJson<LiquidacionDetalleExistente>(
          `${arcaBase}/liquidaciones/${encodeURIComponent(origenId)}${qsTenant}`,
          () => getToken(),
        );
      } catch {
        // Sin detalle se sigue con lo que vino del listado.
      }
      if (cancelled) return;
      const base = (det ?? origen) as LiquidacionDetalleExistente;
      const viajeIds = (base.viajes ?? [])
        .map((lv) => lv.viaje?.id ?? lv.viajeId)
        .filter((id): id is string => Boolean(id));
      preseleccionPendiente.current = viajeIds;
      setConceptosLineas(
        (base.conceptosLineas ?? [])
          .filter((l) => l.conceptoLiquidacionId)
          .map((l) => ({
            conceptoLiquidacionId: l.conceptoLiquidacionId as string,
            monto: l.monto,
            cantidad: l.cantidad ?? 1,
            montoUnitario: l.montoUnitario ?? undefined,
            nombre: l.nombreSnapshot,
            signo: l.signo,
            ivaPct: l.ivaPct ?? undefined,
            modoAplicacion: l.modoAplicacion ?? "GENERAL",
            viajeId: l.viajeId ?? null,
            detalle: l.detalle ?? undefined,
          })),
      );
      if (base.ivaPct != null) setIvaPct(String(base.ivaPct));
      setDetalleExistente(base);
    })();
    return () => {
      cancelled = true;
    };
    // `origen` solo se usa como respaldo si falla el detalle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origenId, arcaBase, qsTenant, getToken]);

  useEffect(() => {
    if (
      resolvedConfig?.ptoVentaCvlp == null ||
      ptoVentaSyncedFromConfig.current
    ) {
      return;
    }
    ptoVentaSyncedFromConfig.current = true;
    setPtoVenta(String(resolvedConfig.ptoVentaCvlp));
  }, [resolvedConfig?.ptoVentaCvlp]);

  useEffect(() => {
    if (viajeInicial || selectedViajeIds.size === 0) return;

    setConceptosLineas((prev) =>
      prev.map((linea) => {
        if (
          linea.modoAplicacion === "VIAJE_PUNTUAL" &&
          linea.viajeId &&
          !selectedViajeIds.has(linea.viajeId)
        ) {
          return { ...linea, viajeId: null, modoAplicacion: "GENERAL" };
        }
        return linea;
      }),
    );
  }, [selectedViajeIds, viajeInicial]);

  useEffect(() => {
    if (comisionEditadaManualmente.current) return;
    const porDefecto =
      transportistas.find((t) => t.id === transportistaId)?.comisionPct ??
      resolvedConfig?.comisionPctDefault;
    setComisionPct(porDefecto != null ? String(porDefecto) : "");
  }, [transportistaId, transportistas, resolvedConfig?.comisionPctDefault]);

  const transportistaSeleccionado = useMemo(() => {
    if (
      transportistaActualizado &&
      transportistaActualizado.id === transportistaId
    ) {
      return transportistaActualizado;
    }
    const fromList = transportistas.find((t) => t.id === transportistaId);
    if (fromList) return fromList as Partial<Transportista>;
    if (
      viajeInicial?.transportistaId === transportistaId &&
      viajeInicial.transportista
    ) {
      return viajeInicial.transportista as Partial<Transportista>;
    }
    if (
      viajeInicial &&
      transportistaEfectivoIdDesdeViaje(viajeInicial) === transportistaId &&
      viajeInicial.transportistaEfectivo
    ) {
      return viajeInicial.transportistaEfectivo as Partial<Transportista>;
    }
    // Liquidación existente abierta desde una pantalla sin la lista de transportistas.
    if (detalleExistente?.transportista && detalleExistente.transportistaId === transportistaId) {
      return { id: transportistaId, ...detalleExistente.transportista } as Partial<Transportista>;
    }
    return null;
  }, [viajeInicial, transportistas, transportistaId, transportistaActualizado, detalleExistente]);

  const condicionIva = transportistaSeleccionado?.condicionIva ?? null;
  // Monotributista en empresa con ARCA: no se emite Líquido Producto. La liquidación queda
  // manual con la factura del transportista adjunta, igual que en una empresa sin ARCA.
  const liquidacionManual =
    hasLiquidoProductoArca &&
    (Boolean(existente?.manual) || esCondicionIvaMonotributo(condicionIva));
  /** Esta liquidación va por ARCA (emisión, pto. de venta, datos fiscales completos). */
  const conArca = hasLiquidoProductoArca && !liquidacionManual;
  const showComprobante = !conArca;
  const cvlpClaseBAlerta = conArca && cvlpClaseBEsperada(condicionIva);

  useEffect(() => {
    if (viajeInicial || !transportistaId) {
      setViajes([]);
      return;
    }
    // Liquidación existente/copiada: se espera su detalle para saber qué viajes preseleccionar.
    if (origen && !detalleExistente) {
      setViajesLoading(true);
      return;
    }
    let cancelled = false;
    setViajesLoading(true);
    setSelectedViajeIds(new Set());
    void (async () => {
      try {
        // Solo los pendientes del transportista; en una liquidación existente, además sus
        // propios viajes (que tienen liquidación activa: esta) vía `incluirLiquidacionId`.
        // Antes se traía todo el historial del transportista y se filtraba acá: con muchos
        // viajes liquidados eran muchas páginas. Se traen todas las páginas: con una sola
        // (máx. 100) los viajes que pasaban de 100 no aparecían, sin ningún aviso.
        const qs = `transportistaId=${encodeURIComponent(transportistaId)}&sinLiquidacionActiva=1${
          existente ? `&incluirLiquidacionId=${encodeURIComponent(existente.id)}` : ""
        }`;
        const todos = await apiJsonTodasLasPaginas<ViajeItem>(
          plataforma
            ? `/api/platform/viajes/paginated?${qs}&tenantId=${encodeURIComponent(tenantId!)}`
            : `/api/viajes/paginated?${qs}`,
          () => getToken(),
        );
        if (!cancelled) {
          const preseleccion = preseleccionPendiente.current;
          preseleccionPendiente.current = null;
          let items = todos;
          if (existente) {
            const propios = new Set(preseleccion ?? []);
            items = items.filter((v) =>
              puedeCambiarViajes
                ? propios.has(v.id) ||
                  (v.etapa !== "cancelado" &&
                    !viajeTieneLiquidacionActivaParaTransportista(v, transportistaId))
                : propios.has(v.id),
            );
          } else {
            // Un viaje cancelado no se liquida: el select de transportistas ya no lo cuenta
            // como pendiente (`transportistasParaNuevaLiquidacion`), y el backend no filtra
            // por etapa en `sinLiquidacionActiva`.
            items = items.filter((v) => v.etapa !== "cancelado");
          }
          setViajes(items);
          if (preseleccion && transportistaId === transportistaIdPreseleccion) {
            const elegidos = items.filter((v) => preseleccion.includes(v.id));
            setSelectedViajeIds(new Set(elegidos.map((v) => v.id)));
            if (elegidos.length < preseleccion.length) {
              showToast(
                `${preseleccion.length - elegidos.length} de los viajes elegidos ya no están disponibles para liquidar a este transportista.`,
                "error",
              );
            }
            const desde = elegidos
              .map((v) => dateInputValueFromIso(v.fechaCarga))
              .filter(Boolean)
              .sort();
            const hasta = elegidos
              .map((v) => dateInputValueFromIso(v.fechaDescarga ?? v.fechaCarga))
              .filter(Boolean)
              .sort();
            if (desde.length > 0) setPeriodoDesde((p) => p || desde[0]);
            if (hasta.length > 0)
              setPeriodoHasta((p) => p || hasta[hasta.length - 1]);
          }
        }
      } catch {
        if (!cancelled) setViajes([]);
      } finally {
        if (!cancelled) setViajesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `existente`/`puedeCambiarViajes` son fijos durante la vida del modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transportistaId,
    transportistaIdPreseleccion,
    viajeInicial,
    getToken,
    showToast,
    detalleExistente,
    plataforma,
    tenantId,
  ]);

  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);

  useEffect(() => {
    let cid = viajeInicial?.clienteId;
    if (!cid && selectedViajeIds.size > 0) {
      const primerViaje = viajes.find((v) => selectedViajeIds.has(v.id));
      cid = (primerViaje as any)?.cliente?.id;
    }
    if (!cid) {
      setClienteDetalle(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const url = tenantId
          ? `/api/platform/clientes/${encodeURIComponent(cid)}?tenantId=${encodeURIComponent(tenantId)}`
          : `/api/clientes/${encodeURIComponent(cid)}`;
        const c = await apiJson<Cliente>(url, () => getToken());
        if (!cancelled) setClienteDetalle(c);
      } catch {
        if (!cancelled) setClienteDetalle(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viajeInicial, selectedViajeIds, viajes, tenantId, getToken]);

  const selectedViajes = useMemo(() => {
    if (viajeInicial) return [viajeInicial as ViajeItem];
    return viajes.filter((v) => selectedViajeIds.has(v.id));
  }, [viajeInicial, viajes, selectedViajeIds]);

  useEffect(() => {
    if (ivaEditadaManualmente.current) return;
    const fromViajes = uniqueIvaPctFromViajes(selectedViajes);
    if (fromViajes != null) {
      setIvaPct(String(fromViajes));
      return;
    }
    if (resolvedConfig?.ivaGastosAdmin != null) {
      setIvaPct(String(resolvedConfig.ivaGastosAdmin));
    }
  }, [selectedViajes, resolvedConfig?.ivaGastosAdmin]);

  const monedaSeleccionada = useMemo<ViajeMonedaCodigo | null>(() => {
    if (selectedViajes.length === 0) return null;
    return monedaViaje(selectedViajes[0]);
  }, [selectedViajes]);

  const clienteSeleccionado = clienteDetalle;

  const missingEmitFields = useMemo(() => {
    if (!conArca || transportistaId === "") return [];
    return collectCvlpEmitMissingFields({
      emisor: resolvedConfig,
      transportista: transportistaSeleccionado ?? {
        idFiscal: null,
        domicilio: null,
        condicionIva: null,
      },
      cliente: clienteSeleccionado,
    });
  }, [
    conArca,
    resolvedConfig,
    transportistaSeleccionado,
    clienteSeleccionado,
    transportistaId,
  ]);

  const isLoadingCliente =
    selectedViajes.length > 0 && clienteSeleccionado === null;
  const missingTransportistaFields = missingEmitFields.filter((f) =>
    f.startsWith("Transportista:"),
  );
  const missingClienteFields =
    selectedViajes.length > 0 && !isLoadingCliente
      ? missingEmitFields.filter((f) => f.startsWith("Cliente:"))
      : [];

  const missingHiddenFields = useHiddenFiscalFields(
    conArca
      ? [...missingTransportistaFields, ...missingClienteFields]
      : [],
  );

  // — Datos faltantes para emitir: mismo manejo que "Nueva factura" —
  // Aviso fijo en el pie (con zumbido al tocar "Emitir") + modal para completarlos que se
  // abre solo una vez por transportista/cliente (primero el transportista, después el cliente).
  const faltantesEmision = [
    ...missingEmitFields.filter((f) => !f.startsWith("Cliente:")),
    ...missingClienteFields,
  ];
  const datosEmitIncompletos = conArca && faltantesEmision.length > 0;
  const mensajeFaltantes = faltantesEmision.every((f) => f.startsWith("Cliente:"))
    ? "Faltan datos del cliente para poder liquidar."
    : faltantesEmision.every((f) => f.startsWith("Transportista:"))
      ? "Faltan datos del transportista para poder liquidar."
      : "Faltan datos para poder liquidar.";
  const zumbidoAviso = useZumbidoAviso();
  const [modalDatos, setModalDatos] = useState<
    "transportista" | "cliente" | null
  >(null);

  // Con un modal anidado abierto, Escape lo cierra a él (no a este).
  useEffect(() => {
    if (modalDatos || confirmarEmision) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) solicitarCierre();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, solicitarCierre, modalDatos, confirmarEmision]);
  const datosAvisadosRef = useRef(new Set<string>());
  const transportistaSeleccionadoId = transportistaSeleccionado?.id;

  // Al elegir el transportista se valida su CUIT contra el padrón de ARCA (opt-in por
  // empresa). Si ARCA informa otra razón social / condición IVA / domicilio, el backend
  // la guarda sola (sin confirmación, el CUIT no se toca) y acá se refresca. Solo un CUIT
  // rechazado (inactivo / inexistente) abre el modal.
  const { tenant: tenantEfectivo } = useTenantPaisFijo(tenantId);
  const validacionPadronHabilitada =
    hasLiquidoProductoArca &&
    tenantEfectivo?.validacionCuitArcaHabilitada === true;
  const padronTransportista = useValidacionPadronRegistro({
    entidad: "transportistas",
    id: transportistaSeleccionadoId,
    habilitado: validacionPadronHabilitada,
    tenantId,
    getToken,
    onActualizado: ({ padron, cambios }) => {
      if (transportistaSeleccionado) {
        setTransportistaActualizado(
          aplicarCambiosPadronTransportista(
            transportistaSeleccionado as Transportista,
            padron,
            cambios,
          ),
        );
      }
      onDataSaved?.();
    },
  });
  const padronTransportistaAviso =
    padronTransportista.resultado?.resultado === "rechazado"
      ? padronTransportista.resultado
      : null;

  // Mismo circuito para el cliente de los viajes elegidos: se valida apenas se conoce y
  // lo que difiera de ARCA se actualiza solo.
  const padronCliente = useValidacionPadronRegistro({
    entidad: "clientes",
    id: clienteDetalle?.id,
    habilitado: validacionPadronHabilitada,
    tenantId,
    getToken,
    onActualizado: ({ padron, cambios }) => {
      setClienteDetalle((c) => (c ? aplicarCambiosPadronCliente(c, padron, cambios) : c));
      onDataSaved?.();
    },
  });
  const padronClienteAviso =
    padronCliente.resultado?.resultado === "rechazado" ? padronCliente.resultado : null;

  // CUIT del transportista (receptor del CVLP) dado de baja / apócrifo en ARCA: no se
  // puede emitir. Se avisa en el pie, igual que los datos faltantes.
  const receptorTransportista = useReceptorPadronBloqueado({
    entidad: "transportistas",
    id: transportistaSeleccionadoId,
    habilitado: conArca,
    tenantId,
    getToken,
    datosKey: transportistaSeleccionado?.idFiscal ?? null,
  });
  const emisionBloqueada = datosEmitIncompletos || receptorTransportista.bloqueado;

  // Hay algo que obliga a mostrar cada modal (se abre solo una vez por motivo).
  const modalTransportistaDisponible = Boolean(
    transportistaSeleccionadoId &&
      (missingTransportistaFields.length > 0 || padronTransportistaAviso),
  );
  const modalClienteDisponible = Boolean(
    clienteDetalle && (missingClienteFields.length > 0 || padronClienteAviso),
  );
  // Datos actualizados solos desde ARCA: el modal no se abre solo, pero queda disponible
  // desde "Ver datos" para revisarlos/editarlos.
  const padronTransportistaActualizado =
    padronTransportista.resultado?.resultado === "actualizado";
  const padronClienteActualizado = padronCliente.resultado?.resultado === "actualizado";
  const modalTransportistaRenderizable = Boolean(
    modalTransportistaDisponible || (transportistaSeleccionadoId && padronTransportistaActualizado),
  );
  const modalClienteRenderizable = Boolean(
    modalClienteDisponible || (clienteDetalle && padronClienteActualizado),
  );
  // Si el estado apunta a un modal que ya no corresponde mostrar, cuenta como cerrado:
  // si no, bloquearía la apertura del otro (ej. abriendo desde la grilla de Viajes).
  const modalDatosVisible =
    (modalDatos === "transportista" && modalTransportistaRenderizable) ||
    (modalDatos === "cliente" && modalClienteRenderizable)
      ? modalDatos
      : null;

  useEffect(() => {
    if (!hasLiquidoProductoArca || modalDatosVisible) return;
    // Se espera la respuesta de ARCA para abrir el modal del transportista ya precargado.
    if (padronTransportista.pendiente) return;
    // La marca de "ya avisado" distingue el motivo: un aviso de datos faltantes no
    // consume el de "ARCA informa otros datos" que puede llegar después.
    if (modalTransportistaDisponible) {
      const key = `t:${transportistaSeleccionadoId}:${padronTransportistaAviso ? "arca" : "faltan"}`;
      if (!datosAvisadosRef.current.has(key)) {
        datosAvisadosRef.current.add(key);
        setModalDatos("transportista");
        return;
      }
    }
    // Ídem para el cliente: se espera la respuesta de ARCA antes de abrir su modal.
    if (padronCliente.pendiente) return;
    if (modalClienteDisponible && clienteDetalle) {
      const key = `c:${clienteDetalle.id}:${padronClienteAviso ? "arca" : "faltan"}`;
      if (!datosAvisadosRef.current.has(key)) {
        datosAvisadosRef.current.add(key);
        setModalDatos("cliente");
      }
    }
  }, [
    hasLiquidoProductoArca,
    modalDatosVisible,
    modalTransportistaDisponible,
    modalClienteDisponible,
    transportistaSeleccionadoId,
    clienteDetalle?.id,
    missingTransportistaFields.length,
    missingClienteFields.length,
    padronTransportistaAviso,
    padronTransportista.pendiente,
    padronClienteAviso,
    padronCliente.pendiente,
  ]);
  const abrirModalDatos =
    transportistaSeleccionadoId &&
    (missingTransportistaFields.length > 0 || padronTransportistaAviso)
      ? () => setModalDatos("transportista")
      : clienteDetalle &&
          (missingClienteFields.length > 0 || padronClienteAviso)
        ? () => setModalDatos("cliente")
        : undefined;

  const bloqueadoUsd = selectedViajes.some((v) =>
    arcaBloqueaLiquidarUsd(
      conArca,
      v.monedaPrecioTransportistaExterno,
    ),
  );

  function toggleViaje(id: string) {
    if (!puedeCambiarViajes) return;
    setSelectedViajeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      const candidato = viajes.find((v) => v.id === id);
      if (!candidato) return prev;
      if (prev.size > 0) {
        const monedaFija = monedaViaje(
          viajes.find((v) => prev.has(v.id)) ?? candidato,
        );
        if (monedaViaje(candidato) !== monedaFija) return prev;
      }
      next.add(id);
      return next;
    });
  }

  async function descargarPdf() {
    if (!liquidacionEmitida) return;
    const pdfUrl = tenantId
      ? `/api/platform/integracion-arca/liquidaciones/${encodeURIComponent(liquidacionEmitida.id)}/pdf?tenantId=${encodeURIComponent(tenantId)}`
      : `/api/integracion-arca/liquidaciones/${encodeURIComponent(liquidacionEmitida.id)}/pdf`;

    setDownloading(true);
    try {
      const res = await apiFetch(pdfUrl, () => getToken());
      if (!res.ok) throw new Error("Error al generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `liquidacion-${liquidacionEmitida.cbteNro ?? liquidacionEmitida.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast("No se pudo descargar el PDF", "error");
    } finally {
      setDownloading(false);
    }
  }

  async function verComprobante() {
    if (!liquidacionEmitida) return;

    if (liquidacionEmitida.cbteNro != null || liquidacionEmitida.cae != null) {
      const pdfUrl = tenantId
        ? `/api/platform/integracion-arca/liquidaciones/${encodeURIComponent(liquidacionEmitida.id)}/pdf?tenantId=${encodeURIComponent(tenantId)}`
        : `/api/integracion-arca/liquidaciones/${encodeURIComponent(liquidacionEmitida.id)}/pdf`;
      const ventana = window.open("", "_blank");

      try {
        const res = await apiFetch(pdfUrl, () => getToken());
        if (!res.ok) throw new Error("Error al generar el PDF");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (ventana) ventana.location.href = blobUrl;
        else window.open(blobUrl, "_blank");
      } catch (err) {
        ventana?.close();
        showToast("No se pudo cargar el PDF del comprobante", "error");
      }
    } else if (liquidacionEmitida.comprobanteUrl) {
      window.open(
        liquidacionEmitida.comprobanteUrl,
        "_blank",
        "noopener,noreferrer",
      );
    }
  }

  async function handleSubmit(
    e: React.FormEvent,
    action: "borrador" | "emitir" = "borrador",
  ) {
    e.preventDefault();
    const effectivePeriodoDesde = showFechaDesde
      ? periodoDesde
      : (periodoDesde || hoyArgentinaIso());
    const effectivePeriodoHasta = showFechaHasta
      ? periodoHasta
      : (periodoHasta || effectivePeriodoDesde || hoyArgentinaIso());

    if (showFechaDesde && !periodoDesde) return;
    if (showFechaHasta && !periodoHasta) return;
    if (
      showFechaDesde &&
      showFechaHasta &&
      effectivePeriodoHasta < effectivePeriodoDesde
    ) {
      setError("La fecha Hasta no puede ser anterior a Desde.");
      return;
    }
    const viajeIds = viajeInicial
      ? [viajeInicial.id]
      : Array.from(selectedViajeIds);
    if (viajeIds.length === 0) {
      setError("Seleccioná al menos un viaje.");
      return;
    }
    if (missingHiddenFields.length > 0) {
      const todosLosFaltantes = [
        ...missingTransportistaFields,
        ...missingClienteFields,
      ].map(formatMissingFiscalField);
      setError(
        `No se puede emitir la liquidación. Faltan los siguientes datos: ${todosLosFaltantes.join(", ")}. Hay campos ocultos que no se pueden editar. Por favor contactá al administrador para habilitarlos.`,
      );
      return;
    }
    if (bloqueadoUsd) {
      setError(MSG_ARCA_NO_LIQUIDA_USD);
      return;
    }
    if (viajeInicial) {
      const yaLiquidadoAEste = elegirTransportistaEnViaje
        ? viajeTieneLiquidacionActivaParaTransportista(
            viajeInicial,
            transportistaId,
          )
        : viajeTieneLiquidacionTransportista(viajeInicial);
      if (yaLiquidadoAEste) {
        setError(
          `La acción no es válida. Ya existe una liquidación previa para este transportista en el viaje #${numeroVisibleViaje(viajeInicial)}.`,
        );
        return;
      }
    }
    if (!viajeInicial && selectedViajes.length > 0) {
      const monedas = new Set(selectedViajes.map((v) => monedaViaje(v)));
      if (monedas.size > 1) {
        setError(
          "Una liquidación no puede mezclar viajes en distintas monedas.",
        );
        return;
      }
    }
    const conceptosCheck = validateConceptosLineasDraft(conceptosLineas);
    if (!conceptosCheck.ok) {
      setConceptosIncomplete(conceptosCheck.indices);
      setError(conceptosCheck.message);
      return;
    }
    const ivaResolved = ivaPct.trim() !== "" ? Number(ivaPct) : 0;
    if (!Number.isFinite(ivaResolved) || ivaResolved < 0 || ivaResolved > 100) {
      setError("El IVA debe ser un número entre 0 y 100.");
      return;
    }
    const ptoVentaNum = Number(ptoVenta);
    const ptoVentaInvalido =
      !ptoVenta.trim() || !Number.isInteger(ptoVentaNum) || ptoVentaNum < 1;
    if (action === "emitir" && ptoVentaInvalido) {
      setError(
        "Falta el punto de venta de CVLP. Configuralo en Configuración ARCA.",
      );
      return;
    }
    if (action === "emitir" && cvlpClaseBAlerta) {
      setError(
        "No se puede emitir: la condición frente al IVA del transportista no corresponde a CVLP 060.",
      );
      return;
    }
    if (action === "emitir" && missingEmitFields.length > 0) {
      setError(
        "No se puede emitir. Faltan datos obligatorios del transportista o cliente.",
      );
      return;
    }
    if (action === "emitir" && montoCero) {
      setError(MSG_EMITIR_MONTO_CERO);
      return;
    }
    if (action === "emitir" && receptorTransportista.bloqueado) {
      zumbidoAviso.disparar();
      return;
    }

    setConceptosIncomplete([]);
    setError(null);
    setSubmitAction(action);

    try {
      let comprobanteUrl: string | undefined;
      if (comprobanteFile) {
        comprobanteUrl = await uploadComprobante(
          () => getToken(),
          comprobanteFile,
          "facturacion",
        );
      }
      const body: Record<string, unknown> = {
        periodoDesde: effectivePeriodoDesde,
        periodoHasta: effectivePeriodoHasta,
      };
      if (!existente) body.transportistaId = transportistaId;
      if (puedeCambiarViajes) body.viajeIds = viajeIds;
      if (comisionPct.trim() !== "") body.comisionPct = Number(comisionPct);
      body.ivaPct = ivaResolved;
      const lineasPayload = toConceptosLineasPayload(conceptosLineas);
      // En una existente se manda siempre (vacío = se quitaron todos los conceptos).
      if (existente || lineasPayload.length > 0) body.conceptosLineas = lineasPayload;
      if (comprobanteUrl) body.comprobanteUrl = comprobanteUrl;
      if (existente) body.proveedorContrato = proveedorContrato?.trim() || null;
      else if (proveedorContrato?.trim()) body.proveedorContrato = proveedorContrato.trim();
      if (showComprobante) {
        const nro = numeroComprobanteProveedor.trim();
        if (existente) body.numeroComprobanteProveedor = nro || null;
        else if (nro) body.numeroComprobanteProveedor = nro;
      }

      // Existente: se guardan los cambios sobre la misma liquidación (no se crea otra).
      let liq = await apiJson<Liquidacion>(
        existente
          ? `${arcaBase}/liquidaciones/${encodeURIComponent(existente.id)}${qsTenant}`
          : `${arcaBase}/liquidaciones${qsTenant}`,
        () => getToken(),
        { method: existente ? "PATCH" : "POST", body: JSON.stringify(body) },
      );

      let emitFailed = false;
      if (action === "emitir") {
        try {
          liq = await apiJson<Liquidacion>(
            `${arcaBase}/liquidaciones/${encodeURIComponent(liq.id)}/emitir${qsTenant}`,
            () => getToken(),
            {
              method: "POST",
              body: JSON.stringify({ ptoVenta: ptoVentaNum }),
            },
          );
        } catch (emitErr) {
          // Sin modal intermedio: la liquidación ya quedó guardada (en borrador o con el
          // error de ARCA, que se ve completo desde la grilla); se cierra y se avisa.
          emitFailed = true;
          try {
            liq = await apiJson<Liquidacion>(
              `${arcaBase}/liquidaciones/${encodeURIComponent(liq.id)}${qsTenant}`,
              () => getToken(),
            );
          } catch {
            /* si falla el refresh, se usa el borrador ya creado */
          }
          showToast(
            `La liquidación quedó guardada, pero no se pudo emitir: ${friendlyError(emitErr, "arca")}`,
            "error",
          );
          onSuccess(liq);
        }
      }

      if (action === "emitir" && !emitFailed) {
        showToast(
          liq.cae
            ? `Comprobante emitido correctamente. CAE: ${liq.cae}`
            : "Comprobante emitido correctamente.",
        );
        setLiquidacionEmitida(liq);
        setStep("autorizada");
        marcarGuardado();

        if (onLiquidacionEmitida) {
          onLiquidacionEmitida(liq);
        }
      } else if (action === "borrador") {
        showToast(
          existente
            ? "Liquidación guardada."
            : liquidacionManual
              ? "Liquidación registrada como liquidada."
              : hasLiquidoProductoArca
                ? "Liquidación guardada en borrador."
                : "Liquidación creada en borrador.",
        );
        onSuccess(liq);
      }
    } catch (err) {
      setError(friendlyError(err, "liquidaciones"));
    } finally {
      setSubmitAction(null);
    }
  }

  const transportistaNombre =
    transportistaSeleccionado?.nombre ??
    transportistas.find((t) => t.id === transportistaId)?.nombre ??
    transportistaId;

  // — Resumen de montos —
  const monedaResumen =
    monedaSeleccionada ?? (viajeInicial ? monedaViaje(viajeInicial) : "ARS");
  const anyHasPrice = selectedViajes.some(
    (v) => v.precioTransportistaExterno != null,
  );

  const bruto = selectedViajes.reduce(
    (sum, v) => sum + (v.precioTransportistaExterno ?? 0),
    0,
  );
  const comisionNum =
    comisionPct.trim() !== ""
      ? Number(comisionPct)
      : (transportistas.find((t) => t.id === transportistaId)?.comisionPct ??
        resolvedConfig?.comisionPctDefault ??
        0);
  const comisionMonto = anyHasPrice ? (bruto * comisionNum) / 100 : 0;
  const conceptosCompletos = conceptosLineas.filter(isConceptoLineaCompleta);

  const getMultiplicador = (modo?: string) =>
    modo === "TODOS_LOS_VIAJES"
      ? Math.max(1, selectedViajes.length)
      : 1;

  const conceptosEfecto = conceptosCompletos.reduce(
    (sum, l) =>
      sum +
      signedMontoConIvaConcepto(l.signo, Number(l.monto) || 0, l.ivaPct) *
        getMultiplicador(l.modoAplicacion),
    0,
  );
  const netoGravado = anyHasPrice ? bruto - comisionMonto : null;
  const ivaPctNum = ivaPct.trim() !== "" ? Number(ivaPct) : 0;
  let ivaGeneral = 0;
  if (selectedViajes.length > 0) {
    let ivaFletes = 0;
    for (const v of selectedViajes) {
      const vIva = v.precioTransportistaIvaIncluidoPct || ivaPctNum;
      const vBruto = v.precioTransportistaExterno ?? 0;
      if (vIva > 0) {
        ivaFletes += (vBruto * vIva) / 100;
      }
    }
    const ivaComision = ivaPctNum > 0 ? (comisionMonto * ivaPctNum) / 100 : 0;
    ivaGeneral = ivaFletes - ivaComision;
  } else {
    ivaGeneral = ((bruto - comisionMonto) * ivaPctNum) / 100;
  }
  const ivaMonto = netoGravado !== null ? ivaGeneral : null;
  // Resumen con el mismo criterio que el PDF del CVLP: los conceptos suman su base al
  // neto gravado y su IVA va junto con el de flete/comisión en una sola línea de IVA.
  const conceptosNeto = conceptosCompletos.reduce(
    (sum, l) =>
      sum +
      signedMontoNetoConcepto(l.signo, Number(l.monto) || 0) *
        getMultiplicador(l.modoAplicacion),
    0,
  );
  const netoGravadoPdf =
    netoGravado !== null ? netoGravado + conceptosNeto : null;
  const ivaTotalPdf =
    ivaMonto !== null ? ivaMonto + (conceptosEfecto - conceptosNeto) : null;
  // IVA desagregado por alícuota (como en Facturas). Misma cuenta que `ivaTotalPdf`:
  // fletes − comisión (con su %) + el IVA propio de cada concepto.
  const ivaPorAlicuota = (() => {
    const porPct = new Map<number, number>();
    const sumar = (pct: number, iva: number) => {
      if (iva !== 0) porPct.set(pct, (porPct.get(pct) ?? 0) + iva);
    };
    if (selectedViajes.length > 0) {
      for (const v of selectedViajes) {
        const pct = v.precioTransportistaIvaIncluidoPct || ivaPctNum;
        if (pct > 0) sumar(pct, ((v.precioTransportistaExterno ?? 0) * pct) / 100);
      }
      if (ivaPctNum > 0) sumar(ivaPctNum, -(comisionMonto * ivaPctNum) / 100);
    } else {
      sumar(ivaPctNum, ((bruto - comisionMonto) * ivaPctNum) / 100);
    }
    for (const l of conceptosCompletos) {
      const mult = getMultiplicador(l.modoAplicacion);
      const monto = Number(l.monto) || 0;
      sumar(
        Number(l.ivaPct ?? ivaPctNum),
        (signedMontoConIvaConcepto(l.signo, monto, l.ivaPct) -
          signedMontoNetoConcepto(l.signo, monto)) *
          mult,
      );
    }
    return [...porPct.entries()]
      .sort(([a], [b]) => b - a)
      .map(([pct, iva]) => ({ pct, iva }));
  })();
  const totalALiquidar =
    netoGravado !== null && ivaMonto !== null
      ? netoGravado + ivaMonto + conceptosEfecto
      : null;
  const showSummary =
    anyHasPrice && (viajeInicial != null || selectedViajeIds.size > 0);
  // Panel de detalle oculto por defecto: mientras tanto se ven los totales en una barra fija.
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const totalesBarra = showSummary
    ? {
        filas: [
          netoGravadoPdf !== null
            ? { label: "Importe neto gravado", value: `${fmtLiquidacionMoney(netoGravadoPdf)} ${monedaResumen}` }
            : { label: "Bruto", value: `${fmtLiquidacionMoney(bruto)} ${monedaResumen}` },
          ...(ivaTotalPdf !== null
            ? ivaPorAlicuota.map(({ pct, iva }) => ({
                label: labelIvaAlicuota(pct),
                value: `${fmtLiquidacionMoney(iva)} ${monedaResumen}`,
              }))
            : []),
        ],
        total:
          totalALiquidar !== null
            ? { label: "Importe total", value: `${fmtLiquidacionMoney(totalALiquidar)} ${monedaResumen}` }
            : null,
      }
    : { filas: [], total: null };
  // ARCA no admite un comprobante por $0: no se deja emitir (el borrador sí se puede guardar).
  const montoCero = !(totalALiquidar != null && totalALiquidar > 0);

  const periodoInvalido = Boolean(
    showFechaDesde && showFechaHasta && periodoDesde && periodoHasta && periodoHasta < periodoDesde,
  );
  // Sin el chequeo de campos ocultos: "Emitir" no se deshabilita por datos faltantes
  // (hace zumbar el aviso del pie); "Guardar borrador" sí sigue bloqueado por ocultos.
  const canSubmitBase =
    Boolean(transportistaId) &&
    (showFechaDesde ? Boolean(periodoDesde) : true) &&
    (showFechaHasta ? Boolean(periodoHasta) : true) &&
    !periodoInvalido &&
    !bloqueadoUsd &&
    (viajeInicial ? true : selectedViajeIds.size > 0);
  const canSubmit = canSubmitBase && missingHiddenFields.length === 0;
  const ptoVentaNumPreview = Number(ptoVenta);
  const ptoVentaInvalidoPreview =
    !ptoVenta.trim() ||
    !Number.isInteger(ptoVentaNumPreview) ||
    ptoVentaNumPreview < 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex w-full flex-col border border-black/10 bg-white shadow-xl overflow-hidden ${
          step === "autorizada"
            ? "h-auto max-w-lg rounded-lg"
            : "h-[min(92dvh,920px)] max-w-[min(90rem,calc(100vw-1rem))]"
        }`}
      >
        {submitAction === "emitir" ? (
          // Emitiendo contra ARCA: se bloquea todo el modal, no solo el botón.
          <BloqueoModal mensaje="Emitiendo la liquidación en ARCA… No cierres esta ventana." />
        ) : step !== "autorizada" && transportistasLoading ? (
          <BloqueoModal mensaje="Cargando transportistas…" />
        ) : null}
        {step === "autorizada" ? (
          <>
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-vialto-charcoal">
                  Liquidación emitida
                </h2>
                <p className="mt-1 text-xs text-vialto-steel">
                  El comprobante fue autorizado por ARCA.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSuccess(liquidacionEmitida!)}
                className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist"
              >
                ✕
              </button>
            </header>

            <div className="overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mx-auto max-w-lg space-y-5">
                <div className="border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-800">
                    Comprobante autorizado por ARCA
                  </p>
                  {liquidacionEmitida?.cae && (
                    <p className="text-xs text-emerald-700 mt-0.5">
                      CAE: {liquidacionEmitida.cae}
                    </p>
                  )}
                  {liquidacionEmitida?.caeFechaVto && (
                    <p className="text-xs text-emerald-700">
                      Vto. CAE: {fmtDate(liquidacionEmitida.caeFechaVto)}
                    </p>
                  )}
                </div>

                <section className="space-y-1.5">
                  <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                    Resumen
                  </p>
                  <div className="flex justify-between text-xs">
                    <span className="text-vialto-steel">Transportista</span>
                    <span className="tabular-nums text-vialto-charcoal">
                      {transportistaNombre}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-vialto-steel">Neto</span>
                    <span className="tabular-nums text-vialto-charcoal">
                      {fmtLiquidacionMoney(
                        (netoGravado ?? 0) + conceptosEfecto,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-vialto-steel">IVA</span>
                    <span className="tabular-nums text-vialto-charcoal">
                      {fmtLiquidacionMoney(ivaMonto ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-vialto-charcoal border-t border-black/10 pt-1.5 mt-0.5">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {fmtLiquidacionMoney(totalALiquidar ?? 0)}
                    </span>
                  </div>
                </section>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => void descargarPdf()}
                    className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                  >
                    {downloading ? "Generando…" : "Descargar PDF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void verComprobante()}
                    className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    Ver comprobante
                  </button>
                  <button
                    type="button"
                    onClick={() => onSuccess(liquidacionEmitida!)}
                    className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-6 py-3.5">
              <div className="flex items-center gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
                  {existente
                    ? conArca
                      ? "Emitir liquidación"
                      : "Editar liquidación"
                    : "Nueva liquidación"}
                </h2>
                {conArca && (
                  <AmbienteTestBadge ambiente={resolvedConfig?.ambiente} />
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* En liquidación la primera fila del formulario ocupa todo el ancho: el botón va acá. */}
                {!detalleAbierto && !isFieldConfigLoading && (
                  <VerDetalleButton onClick={() => setDetalleAbierto(true)} />
                )}
                {!submitting && (
                  <button
                    type="button"
                    onClick={solicitarCierre}
                    className="text-xl leading-none text-vialto-steel hover:text-vialto-charcoal"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex min-h-0 flex-1 flex-col"
            >
              {isFieldConfigLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Spinner className="h-6 w-6 text-vialto-fire" />
                </div>
              ) : (
                <>
                <div
                  className={`grid min-h-0 flex-1 grid-cols-1 ${
                    detalleAbierto ? "lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]" : ""
                  }`}
                >
                <div
                  className={`min-h-0 space-y-4 overflow-y-auto overflow-x-hidden px-6 py-4 ${
                    detalleAbierto ? "lg:border-r lg:border-black/10" : ""
                  }`}
                >
                  {/* Transportista, comisión e IVA en una sola fila. */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                      <label className={labelClass}>
                        Transportista <span className="text-red-500">*</span>
                      </label>
                      {existente || (viajeInicial && !elegirTransportistaEnViaje) ? (
                        <div className="rounded border border-black/10 bg-vialto-mist px-3 py-2 text-sm text-vialto-charcoal">
                          {transportistaNombre}
                        </div>
                      ) : (
                        <select
                          required
                          value={transportistaId}
                          onChange={(e) => setTransportistaId(e.target.value)}
                          className={selectClass}
                        >
                          <option value="">
                            — Seleccioná un transportista —
                          </option>
                          {ordenarAlfabetico(
                            viajeInicial
                              ? transportistaOpcionesViaje
                              : transportistas.map((t) => ({
                                  id: t.id,
                                  nombre: t.nombre,
                                  rolLabel: "",
                                })),
                            (opt) => opt.nombre,
                          ).map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.rolLabel
                                ? `${opt.nombre} — ${opt.rolLabel}`
                                : opt.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {/* La condición frente al IVA del transportista se ve en el tooltip del Receptor (panel derecho). */}
                    {/* El punto de venta no se muestra: sale de Configuración ARCA (ptoVentaCvlp). */}
                    <div>
                      <label htmlFor="comisionPct" className={labelClass}>
                        Comisión por flete (%)
                      </label>
                      <input
                        id="comisionPct"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={comisionPct}
                        onChange={(e) => {
                          comisionEditadaManualmente.current = true;
                          setComisionPct(e.target.value);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ivaPct"
                        className="mb-1 flex items-center gap-1.5 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel"
                      >
                        <span>IVA sobre comisión (%)</span>
                        <div className="group relative flex items-center">
                          <HelpCircle className="h-3.5 w-3.5 cursor-help text-vialto-steel transition-colors hover:text-vialto-charcoal" />
                          {/* Anclado a la derecha del ícono y abriendo hacia abajo: centrado sobresalía del
                              panel (scroll horizontal) y hacia arriba quedaba cortado por el borde superior,
                              porque es la primera fila del panel con scroll. */}
                          <div className="pointer-events-none absolute top-full right-0 z-50 mt-2 w-max max-w-[220px] whitespace-normal rounded bg-vialto-charcoal px-2.5 py-1.5 text-[11px] normal-case leading-tight tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Alícuotas válidas de AFIP: 0%, 2.5%, 5%, 10.5%, 21%
                            y 27%
                            <span className="absolute right-[2px] bottom-full -mb-[1px] border-[5px] border-transparent border-b-vialto-charcoal"></span>
                          </div>
                        </div>
                      </label>
                      <input
                        id="ivaPct"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={ivaPct}
                        onChange={(e) => {
                          ivaEditadaManualmente.current = true;
                          setIvaPct(e.target.value);
                        }}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Proveedor para contrato (opciones dinámicas configuradas por superadmin) */}
                  {opcionesProveedor && opcionesProveedor.length > 0 && (
                    <div>
                      <label htmlFor="proveedorContrato" className={labelClass}>
                        Proveedor para contrato
                      </label>
                      <select
                        id="proveedorContrato"
                        value={proveedorContrato}
                        onChange={(e) => setProveedorContrato(e.target.value)}
                        className={selectClass}
                      >
                        {ordenarAlfabetico(opcionesProveedor, (opt) => opt).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-vialto-steel">
                        Determina el nombre de la empresa que figurará en el título del contrato PDF.
                      </p>
                    </div>
                  )}

                  {/* Período */}
                  {(showFechaDesde || showFechaHasta) && (
                    <div
                      className={`grid ${
                        showFechaDesde && showFechaHasta
                          ? "grid-cols-2"
                          : "grid-cols-1"
                      } gap-3`}
                    >
                      {showFechaDesde && (
                        <div>
                          <label htmlFor="periodoDesde" className={labelClass}>
                            Desde <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="periodoDesde"
                            type="date"
                            required
                            value={periodoDesde}
                            onChange={(e) => {
                              const next = e.target.value;
                              setPeriodoDesde(next);
                              if (periodoHasta && next && periodoHasta < next) {
                                setPeriodoHasta("");
                              }
                            }}
                            className={inputClass}
                          />
                        </div>
                      )}
                      {showFechaHasta && (
                        <div>
                          <label htmlFor="periodoHasta" className={labelClass}>
                            Hasta <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="periodoHasta"
                            type="date"
                            required
                            min={periodoDesde || undefined}
                            value={periodoHasta}
                            onChange={(e) => setPeriodoHasta(e.target.value)}
                            className={`${inputClass} ${
                              periodoInvalido ? "border-red-400" : ""
                            }`}
                          />
                          {periodoInvalido && (
                            <p className="mt-1 text-xs font-medium text-red-600">
                              Hasta no puede ser anterior a Desde.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <ConceptosLiquidacionLineasEditor
                    getToken={getToken}
                    lineas={conceptosLineas}
                    autoFillBlockedConcepts={true}
                    viajesDisponibles={selectedViajes.map((v) => ({
                      id: v.id,
                      numero: numeroVisibleViaje(v),
                    }))}
                    onChange={(next) => {
                      setConceptosLineas(next);
                      setConceptosIncomplete([]);
                    }}
                    disabled={submitting}
                    incompleteIndices={conceptosIncomplete}
                    mostrarEfectoNeto={false}
                  />

                  {viajeInicial && (
                    <div>
                      <p className={labelClass}>Detalle del viaje</p>
                      <div className="space-y-1 rounded border border-black/10 bg-vialto-mist/50 px-3 py-2 text-xs">
                        {idSistemaHabilitado && (
                          <div className="flex justify-between gap-3">
                            <span className="text-vialto-steel">
                              ID sistema
                            </span>
                            <span className="font-medium tabular-nums text-vialto-charcoal">
                              #{viajeInicial.numero}
                            </span>
                          </div>
                        )}
                        {idPropio1Habilitado && (
                          <div className="flex justify-between gap-3">
                            <span className="text-vialto-steel">
                              {idPropio1Label}
                            </span>
                            <span className="font-medium tabular-nums text-vialto-charcoal">
                              {viajeInicial.numeroIdentificacionPersonalizado?.trim() ||
                                "—"}
                            </span>
                          </div>
                        )}
                        {idPropio2Habilitado && (
                          <div className="flex justify-between gap-3">
                            <span className="text-vialto-steel">
                              {idPropio2Label}
                            </span>
                            <span className="font-medium tabular-nums text-vialto-charcoal">
                              {viajeInicial.idPropio2?.trim() || "—"}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between gap-3">
                          <span className="text-vialto-steel">
                            Fecha de carga
                          </span>
                          <span className="tabular-nums text-vialto-charcoal">
                            {viajeInicial.fechaCarga
                              ? fmtDate(viajeInicial.fechaCarga)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-vialto-steel">Origen</span>
                          <span className="text-right text-vialto-charcoal">
                            {viajeInicial.origen ?? "—"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-vialto-steel">Destino</span>
                          <span className="text-right text-vialto-charcoal">
                            {viajeInicial.destino ?? "—"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-vialto-steel">
                            Precio del viaje (s/IVA)
                          </span>
                          <span className="font-medium tabular-nums text-vialto-charcoal">
                            {fmtMoney(
                              viajeInicial.precioTransportistaExterno,
                              viajeInicial.monedaPrecioTransportistaExterno,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!viajeInicial && transportistaId && (
                    <div>
                      <p className={labelClass}>
                        Viajes <span className="text-red-500">*</span>
                        {selectedViajeIds.size > 0 && (
                          <span className="ml-1 normal-case text-vialto-charcoal">
                            ({selectedViajeIds.size} seleccionado
                            {selectedViajeIds.size !== 1 ? "s" : ""})
                          </span>
                        )}
                      </p>
                      <ViajesSeleccionTabla
                        viajes={viajes}
                        selectedIds={Array.from(selectedViajeIds)}
                        onToggle={toggleViaje}
                        idSistemaHabilitado={idSistemaHabilitado}
                        idPropio1Habilitado={idPropio1Habilitado}
                        idPropio1Label={idPropio1Label}
                        idPropio2Habilitado={idPropio2Habilitado}
                        idPropio2Label={idPropio2Label}
                        mostrarCliente
                        mostrarTransporte={false}
                        monedaDe={monedaViaje}
                        montoSinIva
                        ivaSubtotal={{
                          importeDe: (v) => v.precioTransportistaExterno,
                          ivaPctDe: (v) => v.precioTransportistaIvaIncluidoPct || ivaPctNum,
                          formatMonto: (n, v, conMoneda) =>
                            fmtMoney(n, v.monedaPrecioTransportistaExterno, conMoneda),
                        }}
                        renderMonto={(v, conMoneda) =>
                          fmtMoney(
                            v.precioTransportistaExterno,
                            v.monedaPrecioTransportistaExterno,
                            conMoneda,
                          )
                        }
                        cantidadTarifa={{
                          unidad: unidadCantidadViajes(tenantEfectivo),
                          cantidadDe: (v) => v.cantidadTransportista,
                          renderTarifa: (v, conMoneda) =>
                            fmtMoney(
                              v.precioUnitarioTransportista ?? null,
                              v.monedaPrecioTransportistaExterno,
                              conMoneda,
                            ),
                        }}
                        disabledCheck={(v) => {
                          const moneda = monedaViaje(v);
                          const disabled =
                            monedaSeleccionada != null &&
                            moneda !== monedaSeleccionada;
                          return {
                            disabled,
                            title: disabled
                              ? `Este viaje está en ${moneda}. La liquidación ya tiene viajes en ${monedaSeleccionada}.`
                              : undefined,
                          };
                        }}
                        loading={viajesLoading}
                        maxHeightClass="" /* sin alto máximo: la tabla muestra todos sus viajes, el scroll es el del formulario */
                        emptyMessage="No hay viajes registrados para este transportista."
                      />
                    </div>
                  )}

                  {bloqueadoUsd && (
                    <p
                      className="border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      role="alert"
                    >
                      {MSG_ARCA_NO_LIQUIDA_USD}
                    </p>
                  )}

                  {liquidacionManual && (
                    <p className="border border-black/10 bg-vialto-mist px-3 py-2 text-xs text-vialto-charcoal">
                      El transportista es monotributista: no se le emite Líquido Producto en
                      ARCA. La liquidación queda registrada como liquidada; adjuntá la factura
                      que te emitió el transportista.
                    </p>
                  )}

                  {showComprobante && (
                    <div>
                      <label htmlFor="numeroComprobanteProveedor" className={labelClass}>
                        Número de comprobante
                      </label>
                      <input
                        id="numeroComprobanteProveedor"
                        type="text"
                        maxLength={64}
                        value={numeroComprobanteProveedor}
                        onChange={(e) => setNumeroComprobanteProveedor(e.target.value)}
                        placeholder="Ej. 0001-00001234"
                        className={inputClass}
                        disabled={submitting}
                      />
                      <p className="mt-1 text-xs text-vialto-steel">
                        Se muestra en la cuenta corriente del proveedor. Si todavía no la tenés, la
                        podés cargar después.
                      </p>
                    </div>
                  )}

                  {showComprobante && (
                    <ComprobanteAdjuntoField
                      file={comprobanteFile}
                      onFileChange={setComprobanteFile}
                      disabled={submitting}
                    />
                  )}

                  {cvlpClaseBAlerta && (
                    <div
                      className="rounded border border-red-300/60 bg-red-50 px-4 py-3 text-xs text-red-900"
                      role="alert"
                    >
                      <p className="font-medium">
                        No corresponde emitir CVLP 060
                      </p>
                      <p className="mt-1">
                        Condición frente al IVA del transportista:{" "}
                        <span className="font-medium">
                          {condicionIvaLabel(condicionIva)}
                        </span>
                        . {CVLP_CLASE_B_WARNING} No se puede emitir el
                        comprobante; podés guardar la liquidación como borrador.
                      </p>
                    </div>
                  )}
                </div>

                {/* Panel derecho con el mismo formato que "Nueva factura" (FacturaArcaPreviewPanel). */}
                {detalleAbierto && (
                <aside className="flex min-h-0 flex-col border-t border-black/10 bg-white lg:border-t-0">
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                    <DetalleComprobanteEncabezado onOcultar={() => setDetalleAbierto(false)} />
                    <div className="grid grid-cols-2 gap-4">
                      {conArca && (
                        <>
                          <ParteFacturaResumen
                            titulo="Tipo"
                            nombre={cvlpCbteLabel(60)}
                          />
                          <EmisorArcaResumen arcaConfig={resolvedConfig} />
                        </>
                      )}
                      <ParteFacturaResumen
                        titulo="Receptor"
                        nombre={transportistaId ? transportistaNombre : null}
                        detalle={
                          transportistaSeleccionado
                            ? [
                                condicionIvaLabel(condicionIva),
                                transportistaSeleccionado.idFiscal
                                  ? `CUIT ${transportistaSeleccionado.idFiscal}`
                                  : null,
                                transportistaSeleccionado.domicilio?.trim(),
                              ]
                                .filter(Boolean)
                                .join("\n")
                            : undefined
                        }
                        resaltado={padronTransportistaActualizado}
                        estado={
                          transportistaId ? (
                            <PadronValidacionEstado
                              habilitado={validacionPadronHabilitada}
                              pendiente={padronTransportista.pendiente}
                              resultado={padronTransportista.resultado}
                              consultado={padronTransportista.consultado}
                              onRevisar={() => setModalDatos("transportista")}
                              onReintentar={() => void padronTransportista.revalidar()}
                            />
                          ) : undefined
                        }
                      />
                      {/* Cliente de los viajes elegidos: también se valida contra ARCA. */}
                      {clienteDetalle && (
                        <ParteFacturaResumen
                          titulo="Cliente"
                          nombre={clienteDetalle.nombre}
                          detalle={[
                            condicionIvaLabel(clienteDetalle.condicionIva ?? null),
                            clienteDetalle.idFiscal
                              ? `CUIT ${clienteDetalle.idFiscal}`
                              : null,
                            clienteDetalle.direccion?.trim(),
                          ]
                            .filter(Boolean)
                            .join("\n")}
                          resaltado={padronClienteActualizado}
                          estado={
                            <PadronValidacionEstado
                              habilitado={validacionPadronHabilitada}
                              pendiente={padronCliente.pendiente}
                              resultado={padronCliente.resultado}
                              consultado={padronCliente.consultado}
                              onRevisar={() => setModalDatos("cliente")}
                              onReintentar={() => void padronCliente.revalidar()}
                            />
                          }
                        />
                      )}
                    </div>

                    {(showFechaDesde || showFechaHasta) && (
                      <section className="space-y-1">
                        <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                          Comprobante
                        </p>
                        {showFechaDesde && (
                          <ResumenRow label="Período desde" value={periodoDesde ? fmtDate(periodoDesde) : "—"} />
                        )}
                        {showFechaHasta && (
                          <ResumenRow label="Período hasta" value={periodoHasta ? fmtDate(periodoHasta) : "—"} />
                        )}
                      </section>
                    )}

                    <section className="space-y-1.5">
                      <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                        Detalles del viaje
                      </p>
                      {selectedViajes.length === 0 ? (
                        <p className="pt-1 text-xs leading-relaxed text-vialto-steel">
                          Seleccioná transportista y al menos un viaje para ver el
                          desglose de montos.
                        </p>
                      ) : (
                        <div className="space-y-3 pt-1">
                          {selectedViajes.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-start justify-between text-sm"
                            >
                              <ViajeDetallePdfTooltip
                                viaje={v}
                                ivaPct={v.precioTransportistaIvaIncluidoPct || ivaPctNum}
                                tenant={tenantEfectivo}
                              />
                              <ViajeSubtotalTooltip
                                viaje={v}
                                ivaPct={v.precioTransportistaIvaIncluidoPct || ivaPctNum}
                                formatMonto={(n) => fmtMoney(n, monedaViaje(v))}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Comisión y conceptos van aparte (neto, sin IVA, en el orden de carga);
                        abajo quedan solo neto gravado, IVA por alícuota y total. */}
                    {showSummary && (comisionMonto > 0 || conceptosCompletos.length > 0) && (
                      <section className="space-y-1">
                        <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                          {conceptosCompletos.length > 0 ? "Comisión y conceptos" : "Comisión"}
                        </p>
                        {comisionMonto > 0 && (
                          <ResumenRow
                            label={`Comisión por flete ${comisionNum}%`}
                            value={`${fmtSignedLiquidacionMoney(comisionMonto, "minus")} ${monedaResumen}`}
                          />
                        )}
                        {conceptosCompletos.map((l, idx) => {
                          const mult = getMultiplicador(l.modoAplicacion);
                          const neto =
                            signedMontoNetoConcepto(l.signo, Number(l.monto) || 0) * mult;
                          return (
                            <ResumenRow
                              key={`${l.conceptoLiquidacionId}-${idx}`}
                              label={`${nombreConDetalle(l.nombre || "Concepto", l.detalle)}${mult > 1 ? ` (×${mult} viajes)` : ""}`}
                              value={`${fmtSignedLiquidacionMoney(Math.abs(neto), neto >= 0 ? "plus" : "minus")} ${monedaResumen}`}
                            />
                          );
                        })}
                      </section>
                    )}

                    {showSummary && (
                      <div className="space-y-1 border-t border-black/10 pt-2">
                        {netoGravadoPdf !== null && (
                          <ResumenRow
                            label="Importe neto gravado"
                            value={`${fmtLiquidacionMoney(netoGravadoPdf)} ${monedaResumen}`}
                          />
                        )}
                        {ivaTotalPdf !== null &&
                          ivaPorAlicuota.map(({ pct, iva }) => (
                            <ResumenRow
                              key={pct}
                              label={labelIvaAlicuota(pct)}
                              value={`${fmtSignedLiquidacionMoney(Math.abs(iva), iva >= 0 ? "plus" : "minus")} ${monedaResumen}`}
                            />
                          ))}
                        {totalALiquidar !== null && (
                          <div className="flex justify-between pt-1 text-xs font-semibold text-vialto-charcoal">
                            <span>Importe total</span>
                            <span className="tabular-nums">
                              {fmtLiquidacionMoney(totalALiquidar)} {monedaResumen}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </aside>
                )}
              </div>
              {!detalleAbierto && (
                <ResumenTotalesBarra {...totalesBarra} />
              )}
              </>
              )}
            </form>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black/10 px-6 py-4 shrink-0">
              <ErrorPieModal error={error} />
              {datosEmitIncompletos ? (
                <AvisoFaltantesEmision
                  mensaje={mensajeFaltantes}
                  hayOcultos={missingHiddenFields.length > 0}
                  onCompletar={abrirModalDatos}
                  zumbando={zumbidoAviso.zumbando}
                  onZumbidoEnd={zumbidoAviso.terminar}
                />
              ) : (
                receptorTransportista.mensaje && (
                  <AvisoFaltantesEmision
                    mensaje={receptorTransportista.mensaje}
                    hayOcultos={false}
                    bloqueante
                    zumbando={zumbidoAviso.zumbando}
                    onZumbidoEnd={zumbidoAviso.terminar}
                  />
                )
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={solicitarCierre}
                className="h-9 px-4 rounded border border-black/20 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
              >
                Cancelar
              </button>
              {conArca ? (
                <>
                  <button
                    type="button"
                    disabled={submitting || !canSubmit}
                    onClick={(e) =>
                      void handleSubmit(
                        e as unknown as React.FormEvent,
                        "borrador",
                      )
                    }
                    className="inline-flex items-center gap-2 h-9 px-5 rounded border border-black/20 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                  >
                    {submitAction === "borrador" && <Spinner />}
                    {submitAction === "borrador"
                      ? "Guardando…"
                      : existente
                        ? "Guardar cambios"
                        : "Guardar borrador"}
                  </button>
                  {/* Con datos faltantes o CUIT dado de baja no se usa `disabled` (no
                      dispararía el click): se ve deshabilitado y el click hace zumbar el aviso
                      del pie. Mientras se verifica el CUIT en ARCA, sí queda deshabilitado. */}
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      !canSubmitBase ||
                      ptoVentaInvalidoPreview ||
                      cvlpClaseBAlerta ||
                      montoCero ||
                      receptorTransportista.verificando
                    }
                    title={montoCero ? MSG_EMITIR_MONTO_CERO : undefined}
                    aria-disabled={emisionBloqueada || undefined}
                    onClick={() => {
                      if (emisionBloqueada) {
                        zumbidoAviso.disparar();
                        return;
                      }
                      setConfirmarEmision(true);
                    }}
                    className={`inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-charcoal font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white disabled:opacity-50 ${
                      emisionBloqueada
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-vialto-charcoal/90"
                    }`}
                  >
                    {submitAction === "emitir" ? (
                      <Spinner />
                    ) : (
                      <Receipt
                        className="h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    )}
                    {submitAction === "emitir"
                      ? "Emitiendo…"
                      : "Emitir comprobante a ARCA"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={submitting || !canSubmit}
                  onClick={(e) =>
                    void handleSubmit(
                      e as unknown as React.FormEvent,
                      "borrador",
                    )
                  }
                  className="inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-charcoal font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white hover:bg-vialto-charcoal/90 disabled:opacity-50"
                >
                  {submitting && <Spinner />}
                  {submitting
                    ? "Guardando…"
                    : existente
                      ? "Guardar cambios"
                      : liquidacionManual
                        ? "Marcar como liquidada"
                        : "Crear liquidación"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmarEmisionArcaDialog
        open={confirmarEmision}
        comprobante="liquidación"
        ambiente={resolvedConfig?.ambiente}
        onCancel={() => setConfirmarEmision(false)}
        onConfirm={() => {
          setConfirmarEmision(false);
          void handleSubmit({ preventDefault() {} } as React.FormEvent, "emitir");
        }}
      />

      {transportistaSeleccionadoId && modalTransportistaRenderizable && (
          <DatosFiscalesFaltantesModal
            // Remonta al llegar la respuesta de ARCA para que el formulario tome lo actualizado.
            key={`${transportistaSeleccionadoId}-${padronTransportista.resultado?.resultado ?? "sin-arca"}`}
            open={modalDatos === "transportista" && step === "form"}
            entidad="transportista"
            id={transportistaSeleccionadoId}
            nombre={transportistaNombre}
            initial={{
              nombre: transportistaSeleccionado?.nombre ?? "",
              pais: transportistaSeleccionado?.pais ?? null,
              idFiscal: transportistaSeleccionado?.idFiscal ?? null,
              condicionIva: transportistaSeleccionado?.condicionIva ?? null,
              condicionTributaria:
                transportistaSeleccionado?.condicionTributaria ?? null,
              direccion: transportistaSeleccionado?.domicilio ?? null,
            }}
            missingFields={missingTransportistaFields}
            padron={padronTransportistaAviso}
            actualizadoDesdeArca={padronTransportistaActualizado}
            accion="emitir una liquidación"
            tenantId={tenantId}
            getToken={getToken}
            onSaved={(t) => {
              const mismoCuit =
                (t as Transportista).idFiscal === transportistaSeleccionado?.idFiscal;
              setTransportistaActualizado(t as Transportista);
              onDataSaved?.();
              if (padronTransportistaActualizado && mismoCuit) {
                // Editó a mano lo que vino de ARCA: se respeta (no se vuelve a pisar).
                void padronTransportista.confirmar();
              } else {
                // Completó datos o corrigió el CUIT: se valida de nuevo contra ARCA (lo que
                // difiera se actualiza solo; si el CUIT sigue rechazado, el modal se reabre).
                datosAvisadosRef.current.delete(`t:${transportistaSeleccionadoId}:arca`);
                void padronTransportista.revalidar();
              }
            }}
            onClose={() => setModalDatos(null)}
          />
        )}

      {clienteDetalle && modalClienteRenderizable && (
          <DatosFiscalesFaltantesModal
            // Remonta al llegar la respuesta de ARCA para que el formulario tome lo actualizado.
            key={`${clienteDetalle.id}-${padronCliente.resultado?.resultado ?? "sin-arca"}`}
            open={modalDatos === "cliente" && step === "form"}
            entidad="cliente"
            id={clienteDetalle.id}
            nombre={clienteDetalle.nombre}
            initial={{
              nombre: clienteDetalle.nombre ?? "",
              pais: clienteDetalle.pais ?? null,
              idFiscal: clienteDetalle.idFiscal ?? null,
              condicionIva: clienteDetalle.condicionIva ?? null,
              condicionTributaria: clienteDetalle.condicionTributaria ?? null,
              direccion: clienteDetalle.direccion ?? null,
            }}
            missingFields={missingClienteFields}
            padron={padronClienteAviso}
            actualizadoDesdeArca={padronClienteActualizado}
            accion="emitir una liquidación"
            tenantId={tenantId}
            getToken={getToken}
            onSaved={(c) => {
              const mismoCuit = (c as Cliente).idFiscal === clienteDetalle.idFiscal;
              setClienteDetalle(c as Cliente);
              onDataSaved?.();
              if (padronClienteActualizado && mismoCuit) {
                // Editó a mano lo que vino de ARCA: se respeta (no se vuelve a pisar).
                void padronCliente.confirmar();
              } else {
                // Completó datos o corrigió el CUIT: se valida de nuevo contra ARCA.
                datosAvisadosRef.current.delete(`c:${clienteDetalle.id}:arca`);
                void padronCliente.revalidar();
              }
            }}
            onClose={() => setModalDatos(null)}
          />
        )}
      {dialogo}
    </div>
  );
}
