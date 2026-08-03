import { useEffect, useMemo, useRef, useState } from "react";
import { Receipt } from "lucide-react";
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
import { uploadComprobante } from "@/lib/comprobanteUpload";
import {
  normalizeViajeMoneda,
  type ViajeMonedaCodigo,
} from "@/lib/currencyMask";
import { friendlyError } from "@/lib/friendlyError";
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
  /** Tenants con ARCA emiten el comprobante electrónico luego, desde la grilla; no adjuntan comprobante manual acá. */
  hasArca: boolean;
  getToken: () => Promise<string | null>;
  onSuccess: (liq: Liquidacion) => void;
  onClose: () => void;
  tenantId?: string;
}

export function CrearLiquidacionManualModal({
  viajeInicial,
  transportistas,
  config,
  hasArca,
  getToken,
  onSuccess,
  onClose,
}: Props) {
  const showComprobante = !hasArca;
  const { showToast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);

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
  const [ivaPct, setIvaPct] = useState(String(config?.ivaGastosAdmin ?? 21));
  const ivaSyncedFromConfig = useRef(config?.ivaGastosAdmin != null);
  /** Precargado con config ARCA; editable antes de emitir. Solo aplica con integración ARCA. */
  const [ptoVenta, setPtoVenta] = useState(
    config?.ptoVentaCvlp != null ? String(config.ptoVentaCvlp) : "",
  );
  const ptoVentaSyncedFromConfig = useRef(config?.ptoVentaCvlp != null);
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

  useEffect(() => {
    if (config?.ivaGastosAdmin == null || ivaSyncedFromConfig.current) return;
    ivaSyncedFromConfig.current = true;
    setIvaPct(String(config.ivaGastosAdmin));
  }, [config?.ivaGastosAdmin]);

  // Manejo de limpieza de viajeId si se deselecciona un viaje en la UI
  useEffect(() => {
    if (viajeInicial || selectedViajeIds.size === 0) return;

    setConceptosLineas((prev) =>
      prev.map((linea) => {
        if (linea.viajeId && !selectedViajeIds.has(linea.viajeId)) {
          return { ...linea, viajeId: null }; // Vuelve a General
        }
        return linea;
      }),
    );
  }, [selectedViajeIds, viajeInicial]);

  // Autocompletado de la comisión por defecto al cambiar el transportista
  useEffect(() => {
    if (config?.ptoVentaCvlp == null || ptoVentaSyncedFromConfig.current) {
      return;
    }
    ptoVentaSyncedFromConfig.current = true;
    setPtoVenta(String(config.ptoVentaCvlp));
  }, [config?.ptoVentaCvlp]);

  useEffect(() => {
    if (comisionEditadaManualmente.current) return;
    const porDefecto =
      transportistas.find((t) => t.id === transportistaId)?.comisionPct ??
      config?.comisionPctDefault;
    setComisionPct(porDefecto != null ? String(porDefecto) : "");
  }, [transportistaId, transportistas, config?.comisionPctDefault]);

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
        // Defensa en cliente: oculta viajes que aún traigan liquidación activa
        // (p. ej. backend sin el filtro o include sin estado).
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
    const viajeIds = viajeInicial
      ? [viajeInicial.id]
      : Array.from(selectedViajeIds);
    if (viajeIds.length === 0) {
      setError("Seleccioná al menos un viaje.");
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
      ivaPct.trim() !== "" ? Number(ivaPct) : (config?.ivaGastosAdmin ?? 21);
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
          // La liquidación ya se creó (quedó en error/pendiente_cae); refrescamos
          // su estado real para no dejar la grilla desactualizada.
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
        showToast("Liquidación creada en borrador.");
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
        config?.comisionPctDefault ??
        0);
  const comisionMonto = anyHasPrice ? (bruto * comisionNum) / 100 : 0;
  const conceptosCompletos = conceptosLineas.filter(isConceptoLineaCompleta);
  const conceptosEfecto = conceptosCompletos.reduce((sum, l) => {
    const monto = Number(l.monto) || 0;
    return sum + (l.signo === "favor" ? monto : -monto);
  }, 0);
  // Neto = bruto − comisión ± conceptos. Los gastos del viaje van en `otrosGastos`.
  const netoGravado = anyHasPrice
    ? bruto - comisionMonto + conceptosEfecto
    : null;
  const ivaPctNum =
    ivaPct.trim() !== "" ? Number(ivaPct) : (config?.ivaGastosAdmin ?? 21);
  const ivaMonto =
    netoGravado !== null ? (netoGravado * ivaPctNum) / 100 : null;
  const totalALiquidar =
    netoGravado !== null && ivaMonto !== null ? netoGravado + ivaMonto : null;
  const showSummary =
    anyHasPrice && (viajeInicial != null || selectedViajeIds.size > 0);

  const canSubmit =
    Boolean(transportistaId) &&
    Boolean(periodoDesde) &&
    Boolean(periodoHasta) &&
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

        {/* Body */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
        >
          {/* Transportista */}
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
                onChange={(e) => setPeriodoDesde(e.target.value)}
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
                min={periodoDesde}
                value={periodoHasta}
                onChange={(e) => setPeriodoHasta(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Comisión e IVA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="comisionPct" className={labelClass}>
                Comisión (%)
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
              <label htmlFor="ivaPct" className={labelClass}>
                IVA (%)
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
                Solo se usa si emitís la liquidación ahora. Se precarga con el
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

          {/* Viaje pre-fijado */}
          {viajeInicial && (
            <div>
              <p className={labelClass}>Viaje incluido</p>
              <div className="rounded border border-black/10 bg-vialto-mist px-3 py-2 space-y-0.5">
                <p className="text-sm font-medium text-vialto-charcoal">
                  Viaje #{viajeInicial.numero}
                  {viajeInicial.fechaCarga && (
                    <span className="font-normal text-vialto-steel ml-2">
                      — {fmtDate(viajeInicial.fechaCarga)}
                    </span>
                  )}
                </p>
                {(viajeInicial.origen || viajeInicial.destino) && (
                  <p className="text-xs text-vialto-steel">
                    {viajeInicial.origen ?? "—"} → {viajeInicial.destino ?? "—"}
                  </p>
                )}
                <p className="text-xs text-vialto-charcoal">
                  Moneda:{" "}
                  <span className="font-medium">
                    {monedaViaje(viajeInicial)}
                  </span>
                </p>
                {viajeInicial.precioTransportistaExterno != null && (
                  <p className="text-xs text-vialto-charcoal tabular-nums">
                    Bruto:{" "}
                    {fmtMoney(
                      viajeInicial.precioTransportistaExterno,
                      viajeInicial.monedaPrecioTransportistaExterno,
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Selección de viajes (modo sin viajeInicial) */}
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
                <span className={labelClass}>Sub Total</span>
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
                const monto = Number(l.monto) || 0;
                const aFavor = l.signo === "favor";
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
                        monto,
                        aFavor ? "plus" : "minus",
                      )}
                    </span>
                  </div>
                );
              })}
              {netoGravado !== null && (
                <div className="flex justify-between items-baseline border-t border-black/10 pt-1.5">
                  <span className={labelClass}>Neto gravado</span>
                  <span className="tabular-nums text-sm font-medium text-vialto-charcoal">
                    {fmtLiquidacionMoney(netoGravado)}
                  </span>
                </div>
              )}
              {ivaMonto !== null && (
                <div className="flex justify-between items-baseline text-xs text-vialto-steel">
                  <span>IVA {ivaPctNum}%</span>
                  <span className="tabular-nums">
                    {fmtSignedLiquidacionMoney(ivaMonto, "plus")}
                  </span>
                </div>
              )}
              {totalALiquidar !== null && (
                <div className="flex justify-between items-baseline border-t border-black/10 pt-1.5">
                  <span className={labelClass}>Total neto a liquidar</span>
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
            <AmbienteHomologacionWarning ambiente={config?.ambiente} />
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4 shrink-0">
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
                {submitAction === "borrador" ? "Creando…" : "Crear borrador"}
              </button>
              <button
                type="button"
                disabled={submitting || !canSubmit || ptoVentaInvalidoPreview}
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
                {submitAction === "emitir" ? "Emitiendo…" : "Emitir liquidación"}
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
