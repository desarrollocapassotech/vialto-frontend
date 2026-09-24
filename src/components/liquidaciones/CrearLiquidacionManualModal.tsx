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
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { EmitirLiquidacionModal } from "@/components/liquidaciones/EmitirLiquidacionModal";
import { DatosFiscalesFaltantesAlerta } from "@/components/shared/DatosFiscalesFaltantesAlerta";
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
import { uploadComprobante } from "@/lib/comprobanteUpload";
import {
  normalizeViajeMoneda,
  type ViajeMonedaCodigo,
} from "@/lib/currencyMask";
import { friendlyError } from "@/lib/friendlyError";
import {
  ivaGeneralSobreBase,
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
  | "origen"
  | "destino"
  | "precioTransportistaExterno"
  | "monedaPrecioTransportistaExterno"
  | "precioTransportistaIvaIncluidoPct"
  | "liquidacionesViaje"
  | "liquidacionEstado"
  | "otrosGastos"
  | "choferId"
  | "chofer"
  | "productosViaje"
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

function fmtMoney(n: number | null, moneda?: string | null) {
  if (n == null) return "—";
  return formatViajeImporteForListado(n, moneda);
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
  transportistas: Transportista[];
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
  transportistas,
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
  const { isVisible: isViajesVisible } = useFieldConfig("viajes");
  const ivaTransportistaVisible = isViajesVisible(
    "detalle_viaje",
    "precioTransportistaIvaIncluidoPct",
  );

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
      viajeInicial?.transportistaId?.trim() ??
      transportistaOpcionesViaje[0]?.id ??
      "",
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
          setViajes(res.items ?? []);
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
  }, [transportistaId, viajeInicial, getToken]);

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
      setError("Ingresá un punto de venta válido.");
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
  const ivaMonto =
    netoGravado !== null
      ? ivaGeneralSobreBase(bruto, comisionMonto, ivaPctNum)
      : null;
  const totalALiquidar =
    netoGravado !== null && ivaMonto !== null
      ? netoGravado + ivaMonto + conceptosEfecto
      : null;
  const showSummary =
    anyHasPrice && (viajeInicial != null || selectedViajeIds.size > 0);

  const periodoInvalido = Boolean(
    showFechaDesde && showFechaHasta && periodoDesde && periodoHasta && periodoHasta < periodoDesde,
  );
  const canSubmit =
    Boolean(transportistaId) &&
    (showFechaDesde ? Boolean(periodoDesde) : true) &&
    (showFechaHasta ? Boolean(periodoHasta) : true) &&
    !periodoInvalido &&
    !bloqueadoUsd &&
    missingHiddenFields.length === 0 &&
    (viajeInicial ? true : selectedViajeIds.size > 0);
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
        className={`flex w-full flex-col border border-black/10 bg-white shadow-xl overflow-hidden ${
          step === "autorizada"
            ? "h-auto max-w-lg rounded-lg"
            : "h-[min(92dvh,920px)] max-w-6xl"
        }`}
      >
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
                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
                <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-4 lg:border-r lg:border-black/10">
                  {hasLiquidoProductoArca && (
                    <div className="flex items-center justify-between rounded border border-black/10 bg-white px-4 py-2.5">
                      <span className={labelClass}>Comprobante</span>
                      <span className="text-sm text-vialto-charcoal">
                        {cvlpCbteLabel(60)}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    <div>
                      <p className={labelClass}>Condición frente al IVA</p>
                      <div className="rounded border border-black/10 bg-vialto-mist px-3 py-2 text-sm text-vialto-charcoal">
                        {transportistaId
                          ? condicionIvaLabel(condicionIva)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {missingHiddenFields.length > 0 &&
                    transportistaId &&
                    hasLiquidoProductoArca && (
                      <div
                        className="rounded border border-red-500/40 bg-red-50 px-3 py-2 text-xs text-red-900"
                        role="alert"
                      >
                        <p className="font-semibold">
                          Faltan datos fiscales requeridos por ARCA
                        </p>
                        <p className="mt-1">
                          No se puede emitir la liquidación. Faltan los
                          siguientes datos:{" "}
                          <strong>
                            {[
                              ...missingTransportistaFields,
                              ...missingClienteFields,
                            ]
                              .map(formatMissingFiscalField)
                              .join(", ")}
                          </strong>
                          .
                          <br />
                          Hay campos ocultos que no se pueden editar. Por favor
                          contactá al administrador para habilitarlos.
                        </p>
                      </div>
                    )}

                  {missingHiddenFields.length === 0 &&
                    missingTransportistaFields.length > 0 && (
                      <div
                        className="rounded border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                        role="alert"
                      >
                        <p className="font-medium">
                          Faltan datos del transportista:{" "}
                          {missingTransportistaFields
                            .map((f) => f.replace("Transportista: ", ""))
                            .join(", ")}
                          .
                          <br />
                          <strong className="font-bold">
                            Desplazate hacia abajo para completarlos.
                          </strong>
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
                            Precio del viaje
                          </span>
                          <span className="font-medium tabular-nums text-vialto-charcoal">
                            {fmtMoney(
                              viajeInicial.precioTransportistaExterno,
                              viajeInicial.monedaPrecioTransportistaExterno,
                            )}
                            {ivaTransportistaVisible &&
                            viajeInicial.precioTransportistaIvaIncluidoPct
                              ? ` (+${viajeInicial.precioTransportistaIvaIncluidoPct}% IVA en efectivo)`
                              : ""}
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
                            {selectedViajeIds.size !== 1 ? "s" : ""}
                            {monedaSeleccionada
                              ? ` · ${monedaSeleccionada}`
                              : ""}
                            )
                          </span>
                        )}
                      </p>
                      {monedaSeleccionada && (
                        <p className="mb-1.5 text-[11px] text-vialto-steel">
                          Solo podés incluir viajes en {monedaSeleccionada}. Los
                          de otra moneda quedan deshabilitados.
                        </p>
                      )}
                      <ViajesSeleccionTabla
                        viajes={viajes}
                        selectedIds={Array.from(selectedViajeIds)}
                        onToggle={toggleViaje}
                        idSistemaHabilitado={idSistemaHabilitado}
                        idPropio1Habilitado={idPropio1Habilitado}
                        idPropio1Label={idPropio1Label}
                        idPropio2Habilitado={idPropio2Habilitado}
                        idPropio2Label={idPropio2Label}
                        renderMonto={(v) =>
                          fmtMoney(
                            v.precioTransportistaExterno,
                            v.monedaPrecioTransportistaExterno,
                          ) +
                          (ivaTransportistaVisible &&
                          v.precioTransportistaIvaIncluidoPct
                            ? ` (+${v.precioTransportistaIvaIncluidoPct}% IVA en efectivo)`
                            : "")
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
                        maxHeightClass="max-h-44"
                        emptyMessage="No hay viajes registrados para este transportista."
                      />
                    </div>
                  )}

                  {missingClienteFields.length > 0 && (
                    <div
                      className="rounded border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      role="alert"
                    >
                      <p className="font-medium">
                        Faltan datos del cliente:{" "}
                        {missingClienteFields
                          .map((f) => f.replace("Cliente: ", ""))
                          .join(", ")}
                        .
                        <br />
                        <strong className="font-bold">
                          Desplazate hacia abajo para completarlos.
                        </strong>
                      </p>
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

                  <div className="grid grid-cols-2 gap-3">
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
                      <p className="mt-1 text-[11px] leading-snug text-vialto-steel">
                        Si lo dejás vacío se usa el default del tenant
                        {resolvedConfig?.comisionPctDefault != null
                          ? ` (${resolvedConfig.comisionPctDefault}%).`
                          : "."}
                      </p>
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

                  {hasLiquidoProductoArca && (
                    <div>
                      <label
                        htmlFor="ptoVentaLiquidacion"
                        className={labelClass}
                      >
                        Punto de venta
                      </label>
                      <input
                        id="ptoVentaLiquidacion"
                        type="number"
                        min={1}
                        value={ptoVenta}
                        onChange={(e) => setPtoVenta(e.target.value)}
                        className={`${inputClass} w-52`}
                      />
                      <p className="mt-1 text-[11px] leading-snug text-vialto-steel">
                        Solo se usa si emitís el comprobante ahora. Se precarga
                        con el de Configuración ARCA.
                      </p>
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
                  />

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

                  {hasLiquidoProductoArca && missingEmitFields.length > 0 && (
                    <DatosFiscalesFaltantesAlerta
                      missingEmitFields={
                        selectedViajes.length > 0 && !isLoadingCliente
                          ? missingEmitFields
                          : missingEmitFields.filter(
                              (f) => !f.startsWith("Cliente:"),
                            )
                      }
                      clienteDetalle={clienteSeleccionado}
                      onClienteUpdated={(c) => {
                        setClienteDetalle(c);
                        onDataSaved?.();
                      }}
                      transportistaSeleccionado={transportistaSeleccionado}
                      onTransportistaUpdated={(t) => {
                        setTransportistaActualizado(t);
                        onDataSaved?.();
                      }}
                      tenantId={tenantId}
                      getToken={getToken}
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

                <aside className="flex min-h-0 flex-col border-t border-black/10 bg-vialto-mist/40 lg:border-t-0">
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <p className="mb-3 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.18em] text-vialto-steel">
                      Resumen
                    </p>
                    {showSummary ? (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={labelClass}>Moneda</span>
                          <span className="text-sm font-medium text-vialto-charcoal">
                            {monedaResumen}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={labelClass}>Bruto</span>
                          <span className="text-sm font-medium tabular-nums text-vialto-charcoal">
                            {fmtSignedLiquidacionMoney(bruto, "plus")}
                          </span>
                        </div>
                        {anyHasPrice && comisionMonto > 0 && (
                          <div className="flex items-baseline justify-between gap-3 text-xs text-vialto-steel">
                            <span>Comisión {comisionNum}%</span>
                            <span className="tabular-nums">
                              {fmtSignedLiquidacionMoney(
                                comisionMonto,
                                "minus",
                              )}
                            </span>
                          </div>
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
                            <div
                              key={`${l.conceptoLiquidacionId}-${idx}`}
                              className="flex items-baseline justify-between gap-3 text-xs text-vialto-steel"
                            >
                              <span className="min-w-0 break-words">
                                {l.nombre || "Concepto"}
                                {mult > 1 ? ` (×${mult} viajes)` : ""}
                                {l.ivaPct != null ? ` (IVA ${l.ivaPct}%)` : ""}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {fmtSignedLiquidacionMoney(
                                  Math.abs(conIva),
                                  conIva >= 0 ? "plus" : "minus",
                                )}
                              </span>
                            </div>
                          );
                        })}

                        {netoGravado !== null && (
                          <div className="flex items-baseline justify-between gap-3 border-t border-black/10 pt-2">
                            <span className={labelClass}>Subtotal</span>
                            <span className="text-sm font-medium tabular-nums text-vialto-charcoal">
                              {fmtLiquidacionMoney(
                                netoGravado + conceptosEfecto,
                              )}
                            </span>
                          </div>
                        )}
                        {ivaMonto !== null && (
                          <div className="flex items-baseline justify-between gap-3 text-xs text-vialto-steel">
                            <span>IVA {ivaPctNum}% (flete/comisión)</span>
                            <span className="tabular-nums">
                              {fmtSignedLiquidacionMoney(ivaMonto, "plus")}
                            </span>
                          </div>
                        )}
                        {totalALiquidar !== null && (
                          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-black/15 pt-2.5">
                            <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
                              Total a liquidar
                            </span>
                            <span className="text-base font-semibold tabular-nums text-vialto-charcoal">
                              {fmtLiquidacionMoney(totalALiquidar)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed text-vialto-steel">
                        Seleccioná transportista y al menos un viaje para ver el
                        desglose de montos.
                      </p>
                    )}
                  </div>
                </aside>
              </div>
              )}
            </form>

            <div className="flex flex-wrap justify-end gap-3 border-t border-black/10 px-6 py-4 shrink-0">
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
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      !canSubmit ||
                      ptoVentaInvalidoPreview ||
                      cvlpClaseBAlerta
                    }
                    onClick={(e) =>
                      void handleSubmit(
                        e as unknown as React.FormEvent,
                        "emitir",
                      )
                    }
                    className="inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-charcoal font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white hover:bg-vialto-charcoal/90 disabled:opacity-50"
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
    </div>
  );
}
