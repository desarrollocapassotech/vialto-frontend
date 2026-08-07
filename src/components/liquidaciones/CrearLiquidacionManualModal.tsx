import { useEffect, useMemo, useRef, useState } from "react";
import { Receipt, HelpCircle } from "lucide-react"; // <-- Importamos HelpCircle
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
import { AmbienteHomologacionWarning } from "@/components/liquidaciones/AmbienteHomologacionWarning";
import { ViajesSeleccionTabla } from "@/components/shared/ViajesSeleccionTabla";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
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
import { formatViajeImporteForListado } from "@/lib/viajesFlota";
import { viajeTieneLiquidacionTransportista } from "@/lib/viajesComprobantes";
import type {
  Liquidacion,
  Transportista,
  Viaje,
  ArcaConfig,
} from "@/types/api";

type ViajeItem = Pick<
  Viaje,
  | "id"
  | "numero"
  | "fechaCarga"
  | "origen"
  | "destino"
  | "precioTransportistaExterno"
  | "monedaPrecioTransportistaExterno"
  | "liquidacionesViaje"
  | "otrosGastos"
>;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
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

const inputClass =
  "h-9 w-full rounded border border-black/15 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35";
const selectClass = inputClass;
const labelClass =
  "block font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel mb-1";

interface Props {
  /** Si se provee, la liquidación es para este viaje específico (transportista y viaje bloqueados). */
  viajeInicial?: Viaje;
  transportistas: Transportista[];
  config?: ArcaConfig | null;
  /** Tenants con ARCA: tipo CVLP, pto venta y emisión electrónica. Sin ARCA: adjunto manual. */
  hasArca: boolean;
  getToken: () => Promise<string | null>;
  onSuccess: (liq: Liquidacion) => void;
  onClose: () => void;
  tenantId?: string;
}

export function CrearLiquidacionManualModal({
  viajeInicial,
  transportistas,
  config: configProp,
  hasArca,
  getToken,
  onSuccess,
  onClose,
}: Props) {
  const showComprobante = !hasArca;
  const { showToast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [resolvedConfig, setResolvedConfig] = useState<ArcaConfig | null>(
    configProp ?? null,
  );

  // — Campos del formulario —
  const [transportistaId, setTransportistaId] = useState(
    viajeInicial?.transportistaId ?? "",
  );
  const [periodoDesde, setPeriodoDesde] = useState("");
  const [periodoHasta, setPeriodoHasta] = useState("");
  /** Precargada con la comisión propia del transportista o, a falta de ésta, la de config ARCA. */
  const [comisionPct, setComisionPct] = useState("");
  const comisionEditadaManualmente = useRef(false);
  /** Precargado con config ARCA o 21%; el usuario puede poner 0 para liquidar sin IVA. */
  const [ivaPct, setIvaPct] = useState(
    String(configProp?.ivaGastosAdmin ?? 21),
  );
  const ivaSyncedFromConfig = useRef(configProp?.ivaGastosAdmin != null);
  /** Precargado con config ARCA; editable antes de emitir. Solo aplica con integración ARCA. */
  const [ptoVenta, setPtoVenta] = useState(
    configProp?.ptoVentaCvlp != null ? String(configProp.ptoVentaCvlp) : "",
  );
  const ptoVentaSyncedFromConfig = useRef(configProp?.ptoVentaCvlp != null);
  const [conceptosLineas, setConceptosLineas] = useState<ConceptoLineaDraft[]>(
    [],
  );
  const [conceptosIncomplete, setConceptosIncomplete] = useState<number[]>([]);

  // — Selección de viajes (solo cuando no hay viajeInicial) —
  const [viajes, setViajes] = useState<ViajeItem[]>([]);
  const [viajesLoading, setViajesLoading] = useState(false);
  const [selectedViajeIds, setSelectedViajeIds] = useState<Set<string>>(
    viajeInicial ? new Set([viajeInicial.id]) : new Set(),
  );

  // — Comprobante adjunto (tenants sin ARCA) —
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);

  // — Estado del submit —
  const [submitAction, setSubmitAction] = useState<
    "borrador" | "emitir" | null
  >(null);
  const submitting = submitAction !== null;
  const [error, setError] = useState<string | null>(null);

  // Cargar config ARCA si no vino por props (p. ej. desde Viajes).
  useEffect(() => {
    if (configProp) {
      setResolvedConfig(configProp);
      return;
    }
    if (!hasArca) return;
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
  }, [configProp, hasArca, getToken]);

  useEffect(() => {
    if (resolvedConfig?.ivaGastosAdmin == null || ivaSyncedFromConfig.current) {
      return;
    }
    ivaSyncedFromConfig.current = true;
    setIvaPct(String(resolvedConfig.ivaGastosAdmin));
  }, [resolvedConfig?.ivaGastosAdmin]);

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

  // Manejo de limpieza de viajeId si se deselecciona un viaje en la UI
  useEffect(() => {
    if (viajeInicial || selectedViajeIds.size === 0) return;

    setConceptosLineas((prev) =>
      prev.map((linea) => {
        if (linea.viajeId && !selectedViajeIds.has(linea.viajeId)) {
          return { ...linea, viajeId: null };
        }
        return linea;
      }),
    );
  }, [selectedViajeIds, viajeInicial]);

  // Autocompletado de la comisión por defecto al cambiar el transportista
  useEffect(() => {
    if (comisionEditadaManualmente.current) return;
    const porDefecto =
      transportistas.find((t) => t.id === transportistaId)?.comisionPct ??
      resolvedConfig?.comisionPctDefault;
    setComisionPct(porDefecto != null ? String(porDefecto) : "");
  }, [transportistaId, transportistas, resolvedConfig?.comisionPctDefault]);

  const condicionIva =
    viajeInicial?.transportista?.condicionIva ??
    transportistas.find((t) => t.id === transportistaId)?.condicionIva ??
    null;
  const cvlpClaseBAlerta = hasArca && cvlpClaseBEsperada(condicionIva);

  // Cargar viajes cuando cambia el transportista seleccionado (modo sin viajeInicial)
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
          setViajes(
            (res.items ?? []).filter(
              (v) => !viajeTieneLiquidacionTransportista(v),
            ),
          );
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

  /** Moneda ya fijada por la selección actual (null si no hay selección). */
  const monedaSeleccionada = useMemo<ViajeMonedaCodigo | null>(() => {
    if (selectedViajes.length === 0) return null;
    return monedaViaje(selectedViajes[0]);
  }, [selectedViajes]);

  const bloqueadoUsd = selectedViajes.some((v) =>
    arcaBloqueaLiquidarUsd(hasArca, v.monedaPrecioTransportistaExterno),
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

  async function handleSubmit(
    e: React.FormEvent,
    action: "borrador" | "emitir" = "borrador",
  ) {
    e.preventDefault();
    if (!periodoDesde || !periodoHasta) return;
    if (periodoHasta < periodoDesde) {
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
    if (bloqueadoUsd) {
      setError(MSG_ARCA_NO_LIQUIDA_USD);
      return;
    }
    if (viajeInicial && viajeTieneLiquidacionTransportista(viajeInicial)) {
      setError(
        `La acción no es válida. Ya existe una liquidación previa para este transportista en el viaje #${viajeInicial.numero}.`,
      );
      return;
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
    const ivaResolved =
      ivaPct.trim() !== ""
        ? Number(ivaPct)
        : (resolvedConfig?.ivaGastosAdmin ?? 21);
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
    if (action === "emitir" && hasArca && cvlpClaseBEsperada(condicionIva)) {
      setError(
        "No se puede emitir: la condición frente al IVA del transportista no corresponde a CVLP 060.",
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
        periodoDesde,
        periodoHasta,
        viajeIds,
      };
      if (comisionPct.trim() !== "") body.comisionPct = Number(comisionPct);
      // Siempre enviar IVA explícito para no caer al default silencioso del backend.
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
        } catch (emitErr) {
          emitFailed = true;
          try {
            liq = await apiJson<Liquidacion>(
              `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
              () => getToken(),
            );
          } catch {
            /* si falla el refresh, se usa el borrador ya creado */
          }
          showToast(
            `La liquidación se creó, pero no se pudo emitir: ${friendlyError(emitErr, "arca")}. Podés reintentar desde la grilla.`,
            "error",
          );
        }
      }
      if (action === "emitir" && !emitFailed) {
        showToast(
          liq.cae
            ? `Comprobante emitido correctamente. CAE: ${liq.cae}`
            : "Comprobante emitido correctamente.",
        );
      } else if (action === "borrador") {
        showToast(
          hasArca
            ? "Liquidación guardada en borrador."
            : "Liquidación creada en borrador.",
        );
      }
      onSuccess(liq);
    } catch (err) {
      setError(friendlyError(err, "liquidaciones"));
    } finally {
      setSubmitAction(null);
    }
  }

  const transportistaNombre =
    transportistas.find((t) => t.id === transportistaId)?.nombre ??
    viajeInicial?.transportista?.nombre ??
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
  const conceptosEfecto = conceptosCompletos.reduce(
    (sum, l) =>
      sum + signedMontoConIvaConcepto(l.signo, Number(l.monto) || 0, l.ivaPct),
    0,
  );
  const netoGravado = anyHasPrice ? bruto - comisionMonto : null;
  const ivaPctNum =
    ivaPct.trim() !== ""
      ? Number(ivaPct)
      : (resolvedConfig?.ivaGastosAdmin ?? 21);
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
    periodoDesde && periodoHasta && periodoHasta < periodoDesde,
  );
  const canSubmit =
    Boolean(transportistaId) &&
    Boolean(periodoDesde) &&
    Boolean(periodoHasta) &&
    !periodoInvalido &&
    !bloqueadoUsd &&
    (viajeInicial ? true : selectedViajeIds.size > 0);
  const ptoVentaNumPreview = Number(ptoVenta);
  const ptoVentaInvalidoPreview =
    !ptoVenta.trim() ||
    !Number.isInteger(ptoVentaNumPreview) ||
    ptoVentaNumPreview < 1;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current && !submitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl bg-white border border-black/10 shadow-xl flex flex-col max-h-[90dvh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 shrink-0">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
            Nueva liquidación
          </h2>
          {!submitting && (
            <button
              type="button"
              onClick={onClose}
              className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Body — una sola pantalla (sin pasos) */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
        >
          {/* Tipo de comprobante (solo ARCA) */}
          {hasArca && (
            <div className="flex items-center justify-between rounded border border-black/10 bg-white px-4 py-2.5">
              <span className={labelClass}>Comprobante</span>
              <span className="text-sm text-vialto-charcoal">
                {cvlpCbteLabel(60)}
              </span>
            </div>
          )}

          {/* Transportista + condición IVA */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Transportista <span className="text-red-500">*</span>
              </label>
              {viajeInicial ? (
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
                  <option value="">— Seleccioná un transportista —</option>
                  {transportistas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <p className={labelClass}>Condición frente al IVA</p>
              <div className="rounded border border-black/10 bg-vialto-mist px-3 py-2 text-sm text-vialto-charcoal">
                {transportistaId ? condicionIvaLabel(condicionIva) : "—"}
              </div>
            </div>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
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
                className={`${inputClass} ${periodoInvalido ? "border-red-400" : ""}`}
              />
              {periodoInvalido && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  Hasta no puede ser anterior a Desde.
                </p>
              )}
            </div>
          </div>

          {/* Viaje pre-fijado (entrada desde un viaje puntual) */}
          {viajeInicial && (
            <div>
              <p className={labelClass}>Detalle del viaje</p>
              <div className="rounded border border-black/10 bg-vialto-mist/50 px-3 py-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-vialto-steel">Número</span>
                  <span className="tabular-nums text-vialto-charcoal font-medium">
                    #{viajeInicial.numero}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-vialto-steel">Fecha de carga</span>
                  <span className="tabular-nums text-vialto-charcoal">
                    {viajeInicial.fechaCarga
                      ? fmtDate(viajeInicial.fechaCarga)
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-vialto-steel">Origen</span>
                  <span className="text-vialto-charcoal text-right">
                    {viajeInicial.origen ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-vialto-steel">Destino</span>
                  <span className="text-vialto-charcoal text-right">
                    {viajeInicial.destino ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-vialto-steel">Bruto</span>
                  <span className="tabular-nums text-vialto-charcoal font-medium">
                    {fmtMoney(
                      viajeInicial.precioTransportistaExterno,
                      viajeInicial.monedaPrecioTransportistaExterno,
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Selección de viajes (entrada desde Liquidaciones) */}
          {!viajeInicial && transportistaId && (
            <div>
              <p className={labelClass}>
                Viajes a incluir <span className="text-red-500">*</span>
                {selectedViajeIds.size > 0 && (
                  <span className="ml-1 normal-case text-vialto-charcoal">
                    ({selectedViajeIds.size} seleccionado
                    {selectedViajeIds.size !== 1 ? "s" : ""}
                    {monedaSeleccionada ? ` · ${monedaSeleccionada}` : ""})
                  </span>
                )}
              </p>
              {monedaSeleccionada && (
                <p className="mb-1.5 text-[11px] text-vialto-steel">
                  Solo podés incluir viajes en {monedaSeleccionada}. Los de otra
                  moneda quedan deshabilitados.
                </p>
              )}
              <ViajesSeleccionTabla
                viajes={viajes}
                selectedIds={Array.from(selectedViajeIds)}
                onToggle={toggleViaje}
                renderMonto={(v) =>
                  fmtMoney(
                    v.precioTransportistaExterno,
                    v.monedaPrecioTransportistaExterno,
                  )
                }
                disabledCheck={(v) => {
                  const moneda = monedaViaje(v);
                  const disabled =
                    monedaSeleccionada != null && moneda !== monedaSeleccionada;
                  return {
                    disabled,
                    title: disabled
                      ? `Este viaje está en ${moneda}. La liquidación ya tiene viajes en ${monedaSeleccionada}.`
                      : undefined,
                  };
                }}
                loading={viajesLoading}
                maxHeightClass="max-h-72"
                emptyMessage="No hay viajes registrados para este transportista."
              />
            </div>
          )}

          {bloqueadoUsd && (
            <p
              className="text-xs text-amber-900 border border-amber-400/40 bg-amber-50 px-3 py-2"
              role="alert"
            >
              {MSG_ARCA_NO_LIQUIDA_USD}
            </p>
          )}

          {/* Comisión e IVA */}
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
                className="flex items-center gap-1.5 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel mb-1"
              >
                <span>IVA sobre comisión (%)</span>
                <div className="group relative flex items-center">
                  <HelpCircle className="h-3.5 w-3.5 cursor-help text-vialto-steel transition-colors hover:text-vialto-charcoal" />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 whitespace-normal rounded bg-vialto-charcoal px-2.5 py-1.5 text-[11px] normal-case leading-tight tracking-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Alícuotas válidas de AFIP: 0%, 2.5%, 5%, 10.5%, 21% y 27%
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
                onChange={(e) => setIvaPct(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] leading-snug text-vialto-steel">
                Por defecto se aplica {resolvedConfig?.ivaGastosAdmin ?? 21}%.
                Para liquidar sin IVA ingresá 0.
              </p>
            </div>
          </div>

          {hasArca && (
            <div>
              <label htmlFor="ptoVentaLiquidacion" className={labelClass}>
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
                Solo se usa si emitís el comprobante ahora. Se precarga con el
                de Configuración ARCA.
              </p>
            </div>
          )}

          <ConceptosLiquidacionLineasEditor
            getToken={getToken}
            lineas={conceptosLineas}
            viajesDisponibles={selectedViajes.map((v) => ({
              id: v.id,
              numero: v.numero,
            }))}
            onChange={(next) => {
              setConceptosLineas(next);
              setConceptosIncomplete([]);
            }}
            disabled={submitting}
            incompleteIndices={conceptosIncomplete}
          />

          {/* Resumen de montos */}
          {showSummary && (
            <div className="rounded border border-black/10 bg-vialto-mist/60 px-4 py-3 space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className={labelClass}>Moneda</span>
                <span className="text-sm font-medium text-vialto-charcoal">
                  {monedaResumen}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className={labelClass}>Bruto</span>
                <span className="tabular-nums text-sm font-medium text-vialto-charcoal">
                  {fmtSignedLiquidacionMoney(bruto, "plus")}
                </span>
              </div>
              {anyHasPrice && comisionMonto > 0 && (
                <div className="flex justify-between items-baseline text-xs text-vialto-steel">
                  <span>Comisión {comisionNum}%</span>
                  <span className="tabular-nums">
                    {fmtSignedLiquidacionMoney(comisionMonto, "minus")}
                  </span>
                </div>
              )}
              {conceptosCompletos.map((l, idx) => {
                const conIva = signedMontoConIvaConcepto(
                  l.signo,
                  Number(l.monto) || 0,
                  l.ivaPct,
                );
                return (
                  <div
                    key={`${l.conceptoLiquidacionId}-${idx}`}
                    className="flex justify-between items-baseline text-xs text-vialto-steel"
                  >
                    <span>
                      {l.nombre || "Concepto"}
                      {l.ivaPct != null ? ` (IVA ${l.ivaPct}%)` : ""}
                    </span>
                    <span className="tabular-nums">
                      {fmtSignedLiquidacionMoney(
                        Math.abs(conIva),
                        conIva >= 0 ? "plus" : "minus",
                      )}
                    </span>
                  </div>
                );
              })}
              {netoGravado !== null && (
                <div className="flex justify-between items-baseline border-t border-black/10 pt-1.5">
                  <span className={labelClass}>
                    Subtotal (flete − comisión)
                  </span>
                  <span className="tabular-nums text-sm font-medium text-vialto-charcoal">
                    {fmtLiquidacionMoney(netoGravado)}
                  </span>
                </div>
              )}
              {ivaMonto !== null && (
                <div className="flex justify-between items-baseline text-xs text-vialto-steel">
                  <span>IVA {ivaPctNum}% (flete/comisión)</span>
                  <span className="tabular-nums">
                    {fmtSignedLiquidacionMoney(ivaMonto, "plus")}
                  </span>
                </div>
              )}
              {conceptosCompletos.length > 0 && (
                <div className="flex justify-between items-baseline text-xs text-vialto-steel">
                  <span>Efecto neto de conceptos</span>
                  <span className="tabular-nums">
                    {fmtSignedLiquidacionMoney(
                      Math.abs(conceptosEfecto),
                      conceptosEfecto >= 0 ? "plus" : "minus",
                    )}
                  </span>
                </div>
              )}
              {totalALiquidar !== null && (
                <div className="flex justify-between items-baseline border-t border-black/10 pt-1.5">
                  <span className={labelClass}>Total a liquidar</span>
                  <span className="tabular-nums text-base font-semibold text-vialto-charcoal">
                    {fmtLiquidacionMoney(totalALiquidar)}
                  </span>
                </div>
              )}
            </div>
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

          {hasArca && (
            <AmbienteHomologacionWarning ambiente={resolvedConfig?.ambiente} />
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
                  {condicionIvaLabel(condicionIva)}
                </span>
                . {CVLP_CLASE_B_WARNING} No se puede emitir el comprobante;
                podés guardar la liquidación como borrador.
              </p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex flex-wrap justify-end gap-3 border-t border-black/10 px-6 py-4 shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-9 px-4 rounded border border-black/20 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          {hasArca ? (
            <>
              <button
                type="button"
                disabled={submitting || !canSubmit}
                onClick={(e) =>
                  void handleSubmit(e as unknown as React.FormEvent, "borrador")
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
                  void handleSubmit(e as unknown as React.FormEvent, "emitir")
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
                void handleSubmit(e as unknown as React.FormEvent, "borrador")
              }
              className="inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-charcoal font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white hover:bg-vialto-charcoal/90 disabled:opacity-50"
            >
              {submitting && <Spinner />}
              {submitting ? "Creando…" : "Crear liquidación"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
