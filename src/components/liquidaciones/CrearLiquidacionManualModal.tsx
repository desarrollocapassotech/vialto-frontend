import { useEffect, useMemo, useRef, useState } from "react";
import { Receipt, HelpCircle } from "lucide-react";
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
import { EmitirLiquidacionModal } from "@/components/liquidaciones/EmitirLiquidacionModal";
import { DatosFiscalesFaltantesModal } from "@/components/shared/DatosFiscalesFaltantesModal";
import { AvisoFaltantesEmision } from "@/components/shared/AvisoFaltantesEmision";
import { useZumbidoAviso } from "@/hooks/useZumbidoAviso";
import { useValidacionPadronRegistro } from "@/hooks/useValidacionPadronRegistro";
import { useTenantPaisFijo } from "@/hooks/useTenantPaisFijo";
import { PadronValidacionEstado } from "@/components/shared/PadronValidacionEstado";
import { ViajesSeleccionTabla } from "@/components/shared/ViajesSeleccionTabla";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson, apiFetch } from "@/lib/api";
import { collectCvlpEmitMissingFields } from "@/lib/cvlpEmitValidation";
import {
  CVLP_CLASE_B_WARNING,
  condicionIvaLabel,
  cvlpCbteLabel,
  cvlpClaseBEsperada,
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
  signedMontoConIvaConcepto,
} from "@/lib/liquidacionConceptosIva";
import { useToast } from "@/lib/toast";
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

type ViajeItem = Pick<
  Viaje,
  | "id"
  | "numero"
  | "numeroIdentificacionPersonalizado"
  | "idPropio2"
  | "fechaCarga"
  | "fechaDescarga"
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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
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
}

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
}: Props) {
  const showComprobante = !hasLiquidoProductoArca;
  const { showToast } = useToast();

  const overlayRef = useRef<HTMLDivElement>(null);

  const [resolvedConfig, setResolvedConfig] = useState<ArcaConfig | null>(
    configProp ?? null,
  );

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
      (viajeInicial
        ? transportistaOpcionesViaje[0]?.id
        : transportistaIdInicial) ?? "",
  );
  /** Viajes a marcar apenas cargue la lista del transportista inicial (una sola vez). */
  const preseleccionPendiente = useRef<string[] | null>(
    !viajeInicial && transportistaIdInicial && viajeIdsIniciales?.length
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
    dateInputValueFromIso(viajeInicial?.fechaCarga),
  );
  const [periodoHasta, setPeriodoHasta] = useState(() =>
    dateInputValueFromIso(
      viajeInicial?.fechaDescarga ?? viajeInicial?.fechaCarga,
    ),
  );
  const [comisionPct, setComisionPct] = useState("");
  const comisionEditadaManualmente = useRef(false);
  const [ivaPct, setIvaPct] = useState(() => {
    const fromViaje = uniqueIvaPctFromViajes(
      viajeInicial ? [viajeInicial] : [],
    );
    if (fromViaje != null) return String(fromViaje);
    return configProp?.ivaGastosAdmin != null
      ? String(configProp.ivaGastosAdmin)
      : "";
  });
  const ivaEditadaManualmente = useRef(false);
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
  const [emitirPendiente, setEmitirPendiente] = useState<Liquidacion | null>(
    null,
  );

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
          "/api/integracion-arca/config",
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
  }, [configProp, hasLiquidoProductoArca, getToken]);

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
    return null;
  }, [viajeInicial, transportistas, transportistaId, transportistaActualizado]);

  const condicionIva = transportistaSeleccionado?.condicionIva ?? null;
  const cvlpClaseBAlerta =
    hasLiquidoProductoArca && cvlpClaseBEsperada(condicionIva);

  useEffect(() => {
    if (viajeInicial || !transportistaId) {
      setViajes([]);
      return;
    }
    let cancelled = false;
    setViajesLoading(true);
    setSelectedViajeIds(new Set());
    void (async () => {
      try {
        const res = await apiJson<{ items: ViajeItem[] }>(
          `/api/viajes/paginated?transportistaId=${encodeURIComponent(transportistaId)}&pageSize=100&page=1&sinLiquidacionActiva=1`,
          () => getToken(),
        );
        if (!cancelled) {
          const items = res.items ?? [];
          setViajes(items);
          const preseleccion = preseleccionPendiente.current;
          preseleccionPendiente.current = null;
          if (preseleccion && transportistaId === transportistaIdInicial) {
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
  }, [transportistaId, transportistaIdInicial, viajeInicial, getToken, showToast]);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

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
    if (!hasLiquidoProductoArca || transportistaId === "") return [];
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
    hasLiquidoProductoArca,
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
    hasLiquidoProductoArca
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
  const datosEmitIncompletos =
    hasLiquidoProductoArca && faltantesEmision.length > 0;
  const mensajeFaltantes = faltantesEmision.every((f) => f.startsWith("Cliente:"))
    ? "Faltan datos del cliente para poder liquidar."
    : faltantesEmision.every((f) => f.startsWith("Transportista:"))
      ? "Faltan datos del transportista para poder liquidar."
      : "Faltan datos para poder liquidar.";
  const zumbidoAviso = useZumbidoAviso();
  const [modalDatos, setModalDatos] = useState<
    "transportista" | "cliente" | null
  >(null);
  const datosAvisadosRef = useRef(new Set<string>());
  const transportistaSeleccionadoId = transportistaSeleccionado?.id;

  // Al elegir el transportista se valida su CUIT contra el padrón de ARCA (opt-in por
  // empresa). Si ARCA informa otra condición IVA / domicilio, o el CUIT no está activo,
  // se abre el mismo modal con lo de ARCA precargado.
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
  });
  const padronTransportistaAviso =
    padronTransportista.resultado?.resultado === "diferencias" ||
    padronTransportista.resultado?.resultado === "rechazado"
      ? padronTransportista.resultado
      : null;

  // Mismo circuito para el cliente de los viajes elegidos: se valida apenas se conoce,
  // se precarga lo de ARCA en su modal y, al guardar, queda la huella de validado.
  const padronCliente = useValidacionPadronRegistro({
    entidad: "clientes",
    id: clienteDetalle?.id,
    habilitado: validacionPadronHabilitada,
    tenantId,
    getToken,
  });
  const padronClienteAviso =
    padronCliente.resultado?.resultado === "diferencias" ||
    padronCliente.resultado?.resultado === "rechazado"
      ? padronCliente.resultado
      : null;

  // Hay algo para mostrar en cada modal (si no, el modal ni se renderiza).
  const modalTransportistaDisponible = Boolean(
    transportistaSeleccionadoId &&
      (missingTransportistaFields.length > 0 || padronTransportistaAviso),
  );
  const modalClienteDisponible = Boolean(
    clienteDetalle && (missingClienteFields.length > 0 || padronClienteAviso),
  );
  // Si el estado apunta a un modal que ya no corresponde mostrar, cuenta como cerrado:
  // si no, bloquearía la apertura del otro (ej. abriendo desde la grilla de Viajes).
  const modalDatosVisible =
    (modalDatos === "transportista" && modalTransportistaDisponible) ||
    (modalDatos === "cliente" && modalClienteDisponible)
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
      hasLiquidoProductoArca,
      v.monedaPrecioTransportistaExterno,
    ),
  );

  function toggleViaje(id: string) {
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
      : (periodoDesde || new Date().toISOString().slice(0, 10));
    const effectivePeriodoHasta = showFechaHasta
      ? periodoHasta
      : (periodoHasta || effectivePeriodoDesde || new Date().toISOString().slice(0, 10));

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
    if (
      action === "emitir" &&
      hasLiquidoProductoArca &&
      cvlpClaseBEsperada(condicionIva)
    ) {
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
        transportistaId,
        periodoDesde: effectivePeriodoDesde,
        periodoHasta: effectivePeriodoHasta,
        viajeIds,
      };
      if (comisionPct.trim() !== "") body.comisionPct = Number(comisionPct);
      body.ivaPct = ivaResolved;
      const lineasPayload = toConceptosLineasPayload(conceptosLineas);
      if (lineasPayload.length > 0) body.conceptosLineas = lineasPayload;
      if (comprobanteUrl) body.comprobanteUrl = comprobanteUrl;

      let liq = await apiJson<Liquidacion>(
        "/api/integracion-arca/liquidaciones",
        () => getToken(),
        { method: "POST", body: JSON.stringify(body) },
      );

      let emitFailed = false;
      if (action === "emitir") {
        try {
          liq = await apiJson<Liquidacion>(
            `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/emitir`,
            () => getToken(),
            {
              method: "POST",
              body: JSON.stringify({ ptoVenta: ptoVentaNum }),
            },
          );
        } catch {
          emitFailed = true;
          try {
            liq = await apiJson<Liquidacion>(
              `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
              () => getToken(),
            );
          } catch {
            /* si falla el refresh, se usa el borrador ya creado */
          }
          setEmitirPendiente(liq);
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

        if (onLiquidacionEmitida) {
          onLiquidacionEmitida(liq);
        }
      } else if (action === "borrador") {
        showToast(
          hasLiquidoProductoArca
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
      ? Math.max(1, selectedViajeIds.size + (viajeInicial ? 1 : 0))
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
  const totalALiquidar =
    netoGravado !== null && ivaMonto !== null
      ? netoGravado + ivaMonto + conceptosEfecto
      : null;
  const showSummary =
    anyHasPrice && (viajeInicial != null || selectedViajeIds.size > 0);
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

  if (emitirPendiente) {
    return (
      <EmitirLiquidacionModal
        liq={emitirPendiente}
        getToken={getToken}
        tenantId={tenantId}
        arcaConfig={resolvedConfig}
        ivaPct={emitirPendiente.ivaPct ?? resolvedConfig?.ivaGastosAdmin}
        onSuccess={(updated) => {
          setEmitirPendiente(null);
          showToast(
            updated.cae
              ? `Comprobante emitido correctamente. CAE: ${updated.cae}`
              : "Comprobante emitido correctamente.",
          );
          onSuccess(updated);
        }}
        onClose={() => {
          setEmitirPendiente(null);
          onSuccess(emitirPendiente);
        }}
      />
    );
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current && !submitting) {
          if (step === "autorizada") onSuccess(liquidacionEmitida!);
          else onClose();
        }
      }}
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
        {step !== "autorizada" && transportistasLoading ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <Spinner className="h-8 w-8 text-vialto-charcoal" />
            <p className="text-sm font-medium text-vialto-charcoal">
              Cargando transportistas…
            </p>
          </div>
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
                  Nueva liquidación
                </h2>
                {hasLiquidoProductoArca && (
                  <AmbienteTestBadge ambiente={resolvedConfig?.ambiente} />
                )}
              </div>
              {!submitting && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xl leading-none text-vialto-steel hover:text-vialto-charcoal"
                >
                  ×
                </button>
              )}
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
                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
                <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-4 lg:border-r lg:border-black/10">
                  {/* Transportista, comisión e IVA en una sola fila. */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                      <label className={labelClass}>
                        Transportista <span className="text-red-500">*</span>
                      </label>
                      {viajeInicial && !elegirTransportistaEnViaje ? (
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
                          {(viajeInicial
                            ? transportistaOpcionesViaje
                            : transportistas.map((t) => ({
                                id: t.id,
                                nombre: t.nombre,
                                rolLabel: "",
                              }))
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
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 whitespace-normal rounded bg-vialto-charcoal px-2.5 py-1.5 text-[11px] normal-case leading-tight tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Alícuotas válidas de AFIP: 0%, 2.5%, 5%, 10.5%, 21%
                            y 27%
                            <span className="absolute left-1/2 top-full -mt-[1px] -translate-x-1/2 border-[5px] border-transparent border-t-vialto-charcoal"></span>
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
                        Viajes a incluir <span className="text-red-500">*</span>
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
                        renderMonto={(v, conMoneda) =>
                          fmtMoney(
                            v.precioTransportistaExterno,
                            v.monedaPrecioTransportistaExterno,
                            conMoneda,
                          )
                        }
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

                  {showComprobante && (
                    <ComprobanteAdjuntoField
                      file={comprobanteFile}
                      onFileChange={setComprobanteFile}
                      disabled={submitting}
                    />
                  )}

                  {error && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                      {error}
                    </div>
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
                <aside className="flex min-h-0 flex-col border-t border-black/10 bg-white lg:border-t-0">
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                    <div className="grid grid-cols-2 gap-4">
                      {hasLiquidoProductoArca && (
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
                                idPropio2Habilitado={idPropio2Habilitado}
                                idPropio2Label={idPropio2Label}
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

                    {showSummary && (
                      <div className="space-y-1 border-t border-black/10 pt-2">
                        <ResumenRow
                          label="Bruto"
                          value={`${fmtLiquidacionMoney(bruto)} ${monedaResumen}`}
                        />
                        {comisionMonto > 0 && (
                          <ResumenRow
                            label={`Comisión ${comisionNum}%`}
                            value={`${fmtSignedLiquidacionMoney(comisionMonto, "minus")} ${monedaResumen}`}
                          />
                        )}
                        {conceptosCompletos.map((l, idx) => {
                          const mult = getMultiplicador(l.modoAplicacion);
                          const conIva =
                            signedMontoConIvaConcepto(
                              l.signo,
                              Number(l.monto) || 0,
                              l.ivaPct,
                            ) * mult;
                          return (
                            <ResumenRow
                              key={`${l.conceptoLiquidacionId}-${idx}`}
                              label={`${l.nombre || "Concepto"}${mult > 1 ? ` (×${mult} viajes)` : ""}${l.ivaPct != null ? ` (IVA ${l.ivaPct}%)` : ""}`}
                              value={`${fmtSignedLiquidacionMoney(Math.abs(conIva), conIva >= 0 ? "plus" : "minus")} ${monedaResumen}`}
                            />
                          );
                        })}
                        {netoGravado !== null && (
                          <ResumenRow
                            label="Subtotal"
                            value={`${fmtLiquidacionMoney(netoGravado + conceptosEfecto)} ${monedaResumen}`}
                          />
                        )}
                        {ivaMonto !== null && (
                          <ResumenRow
                            label={`IVA ${ivaPctNum}% (flete/comisión)`}
                            value={`${fmtSignedLiquidacionMoney(ivaMonto, "plus")} ${monedaResumen}`}
                          />
                        )}
                        {totalALiquidar !== null && (
                          <div className="flex justify-between pt-1 text-xs font-semibold text-vialto-charcoal">
                            <span>Total a liquidar</span>
                            <span className="tabular-nums">
                              {fmtLiquidacionMoney(totalALiquidar)} {monedaResumen}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
              )}
            </form>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black/10 px-6 py-4 shrink-0">
              {datosEmitIncompletos && (
                <AvisoFaltantesEmision
                  mensaje={mensajeFaltantes}
                  hayOcultos={missingHiddenFields.length > 0}
                  onCompletar={abrirModalDatos}
                  zumbando={zumbidoAviso.zumbando}
                  onZumbidoEnd={zumbidoAviso.terminar}
                />
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="h-9 px-4 rounded border border-black/20 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
              >
                Cancelar
              </button>
              {hasLiquidoProductoArca ? (
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
                      : "Guardar borrador"}
                  </button>
                  {/* Con datos faltantes no se usa `disabled` (no dispararía el click): se ve
                      deshabilitado y el click hace zumbar el aviso del pie. */}
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      !canSubmitBase ||
                      ptoVentaInvalidoPreview ||
                      cvlpClaseBAlerta ||
                      montoCero
                    }
                    title={montoCero ? MSG_EMITIR_MONTO_CERO : undefined}
                    aria-disabled={datosEmitIncompletos || undefined}
                    onClick={(e) => {
                      if (datosEmitIncompletos) {
                        zumbidoAviso.disparar();
                        return;
                      }
                      void handleSubmit(
                        e as unknown as React.FormEvent,
                        "emitir",
                      );
                    }}
                    className={`inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-charcoal font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white disabled:opacity-50 ${
                      datosEmitIncompletos
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
                  {submitting ? "Creando…" : "Crear liquidación"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {transportistaSeleccionadoId &&
        (missingTransportistaFields.length > 0 || padronTransportistaAviso) && (
          <DatosFiscalesFaltantesModal
            // Remonta al llegar la respuesta de ARCA para que el formulario tome lo precargado.
            key={`${transportistaSeleccionadoId}-${padronTransportistaAviso?.resultado ?? "sin-arca"}`}
            open={modalDatos === "transportista" && step === "form"}
            entidad="transportista"
            id={transportistaSeleccionadoId}
            nombre={transportistaNombre}
            initial={{
              nombre: transportistaSeleccionado?.nombre ?? "",
              pais: transportistaSeleccionado?.pais ?? null,
              idFiscal: transportistaSeleccionado?.idFiscal ?? null,
              condicionIva:
                padronTransportistaAviso?.resultado === "diferencias" &&
                padronTransportistaAviso.diferencias.includes("condicionIva")
                  ? padronTransportistaAviso.padron.condicionIva
                  : (transportistaSeleccionado?.condicionIva ?? null),
              condicionTributaria:
                transportistaSeleccionado?.condicionTributaria ?? null,
              direccion:
                padronTransportistaAviso?.resultado === "diferencias" &&
                padronTransportistaAviso.diferencias.includes("domicilio")
                  ? padronTransportistaAviso.padron.domicilio
                  : (transportistaSeleccionado?.domicilio ?? null),
            }}
            missingFields={missingTransportistaFields}
            padron={padronTransportistaAviso}
            accion="emitir una liquidación"
            tenantId={tenantId}
            getToken={getToken}
            onSaved={(t) => {
              setTransportistaActualizado(t as Transportista);
              onDataSaved?.();
              if (padronTransportistaAviso) {
                // Revisó y guardó contra lo de ARCA: queda marcado como validado.
                void padronTransportista.confirmar();
              } else {
                // Completó datos que faltaban (ej. el CUIT): se valida ahora. Si ARCA
                // informa algo distinto, el modal se vuelve a abrir con eso precargado.
                datosAvisadosRef.current.delete(`t:${transportistaSeleccionadoId}:arca`);
                void padronTransportista.revalidar();
              }
            }}
            onClose={() => setModalDatos(null)}
          />
        )}

      {clienteDetalle &&
        (missingClienteFields.length > 0 || padronClienteAviso) && (
          <DatosFiscalesFaltantesModal
            // Remonta al llegar la respuesta de ARCA para que el formulario tome lo precargado.
            key={`${clienteDetalle.id}-${padronClienteAviso?.resultado ?? "sin-arca"}`}
            open={modalDatos === "cliente" && step === "form"}
            entidad="cliente"
            id={clienteDetalle.id}
            nombre={clienteDetalle.nombre}
            initial={{
              nombre: clienteDetalle.nombre ?? "",
              pais: clienteDetalle.pais ?? null,
              idFiscal: clienteDetalle.idFiscal ?? null,
              condicionIva:
                padronClienteAviso?.resultado === "diferencias" &&
                padronClienteAviso.diferencias.includes("condicionIva")
                  ? padronClienteAviso.padron.condicionIva
                  : (clienteDetalle.condicionIva ?? null),
              condicionTributaria: clienteDetalle.condicionTributaria ?? null,
              direccion:
                padronClienteAviso?.resultado === "diferencias" &&
                padronClienteAviso.diferencias.includes("domicilio")
                  ? padronClienteAviso.padron.domicilio
                  : (clienteDetalle.direccion ?? null),
            }}
            missingFields={missingClienteFields}
            padron={padronClienteAviso}
            accion="emitir una liquidación"
            tenantId={tenantId}
            getToken={getToken}
            onSaved={(c) => {
              setClienteDetalle(c as Cliente);
              onDataSaved?.();
              if (padronClienteAviso) {
                // Revisó y guardó contra lo de ARCA: se guarda la huella de validado.
                void padronCliente.confirmar();
              } else {
                // Completó datos que faltaban (ej. el CUIT): se valida ahora; si ARCA
                // coincide se guarda la huella, si no, el modal se reabre precargado.
                datosAvisadosRef.current.delete(`c:${clienteDetalle.id}:arca`);
                void padronCliente.revalidar();
              }
            }}
            onClose={() => setModalDatos(null)}
          />
        )}
    </div>
  );
}
