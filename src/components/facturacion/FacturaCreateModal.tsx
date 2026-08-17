import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Receipt } from "lucide-react";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import { FacturaArcaPreviewPanel } from "@/components/facturacion/FacturaArcaPreviewPanel";
import {
  FacturaTotalesPreview,
  facturaPayloadFromDraft,
  filterFacturaTramosByViajeIds,
  validateFacturaDraftTramos,
  ViajesVinculadosEditor,
  type FacturaDraft,
} from "@/components/facturacion/FacturaEditModal";
import {
  FacturaTramosEditor,
  emptyFacturaTramoDraft,
} from "@/components/facturacion/FacturaTramosEditor";
import {
  computeFacturaTotales,
  defaultFacturaLineasFromDraft,
  toFacturaLineasPayload,
  validateFacturaLineasDraft,
} from "@/components/facturacion/FacturaLineasEditor";
import {
  ClienteSearchSelect,
  TransportistaSearchSelect,
} from "@/components/forms/MaestroSearchSelects";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { AdjuntoPreviewModal } from "@/components/shared/AdjuntoPreviewModal";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError, apiFetch, apiJson } from "@/lib/api";
import {
  facturaLetraFromCondicionIva,
  facturaLetraLabel,
} from "@/lib/arcaCbteTipo";
import {
  collectFacturaEmitMissingFields,
  formatFacturaEmitMissingMessage,
} from "@/lib/facturaEmitValidation";
import { uploadComprobante } from "@/lib/comprobanteUpload";
import { friendlyError } from "@/lib/friendlyError";
import {
  MSG_ARCA_NO_FACTURA_USD,
  arcaBloqueaFacturarUsd,
} from "@/lib/arcaUsdRestriction";
import { useToast } from "@/lib/toast";
import {
  monedaUnicaDeViajes,
  textoImporteFacturaSeleccion,
} from "@/lib/viajesFlota";
import type {
  ArcaConfig,
  Cliente,
  Factura,
  Transportista,
  Viaje,
} from "@/types/api";

const compactInputClass =
  "h-8 w-full border border-black/15 bg-white px-2 text-sm";

const compactLabelClass =
  "text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel";

const standardInputClass =
  "h-9 w-full border border-black/15 bg-white px-2 text-sm";

function useEscapeKey(active: boolean, disabled: boolean, onClose: () => void) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled) {
        e.preventDefault();
        onClose();
      }
    },
    [disabled, onClose],
  );
  useEffect(() => {
    if (!active) return;
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, handler]);
}

function validateFacturaDraft(
  draft: FacturaDraft,
  viajes: Viaje[],
  hasArca: boolean,
): string | null {
  if (!hasArca && !draft.numero.trim()) return "Ingresá el número de factura.";
  if (!draft.fechaEmision) return "Ingresá la fecha de emisión.";
  if (monedaUnicaDeViajes(draft.viajeIds, viajes) === null) {
    return "Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.";
  }
  if (
    hasArca &&
    draft.viajeIds.some((id) => {
      const v = viajes.find((x) => x.id === id);
      return v ? arcaBloqueaFacturarUsd(true, v.monedaMonto) : false;
    })
  ) {
    return MSG_ARCA_NO_FACTURA_USD;
  }
  return null;
}

function fmtPreviewDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtPreviewMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
}

function FacturaContraparteField({
  tipo,
  clienteId,
  transportistaId,
  clientes,
  transportistas,
  onClienteChange,
  onTransportistaChange,
  compact = false,
}: {
  tipo: FacturaDraft["tipo"];
  clienteId: string;
  transportistaId: string;
  clientes: Cliente[];
  transportistas: Transportista[];
  onClienteChange: (id: string) => void;
  onTransportistaChange: (id: string) => void;
  compact?: boolean;
}) {
  const esTransportista = tipo === "transportista_externo";
  const labelClass = compact
    ? compactLabelClass
    : "text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel";
  const inputClass = compact ? compactInputClass : standardInputClass;

  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>
        {esTransportista ? "Transportista" : "Cliente"}
      </label>
      {esTransportista ? (
        <TransportistaSearchSelect
          transportistas={transportistas}
          value={transportistaId}
          onChange={onTransportistaChange}
          inputClassName={inputClass}
          emptyListChoiceLabel="— Sin transportista —"
          placeholderCerrado="— Sin transportista —"
          aria-label="Transportista"
        />
      ) : (
        <ClienteSearchSelect
          clientes={clientes}
          value={clienteId}
          onChange={onClienteChange}
          inputClassName={inputClass}
          allowEmptyValue
          emptyListChoiceLabel="— Sin cliente —"
          placeholderCerrado="— Sin cliente —"
          aria-label="Cliente"
        />
      )}
    </div>
  );
}

export type FacturaCreateModalProps = {
  open: boolean;
  draft: FacturaDraft;
  setDraft: Dispatch<SetStateAction<FacturaDraft>>;
  clientes: Cliente[];
  transportistas: Transportista[];
  viajes: Viaje[];
  viajesNueva: Viaje[];
  viajesLoading: boolean;
  onClose: () => void;
  onSave?: () => void;
  saving?: boolean;
  error?: string | null;
  showComprobanteAdjunto?: boolean;
  hasArca?: boolean;
  tenantId?: string;
  getToken?: () => Promise<string | null>;
  facturasCreateUrl?: string;
  onFacturaGuardada?: (factura: Factura) => void;
  onFacturaEmitida?: (factura: Factura) => void;
};

export function FacturaCreateModal({
  open,
  draft,
  setDraft,
  clientes,
  transportistas,
  viajes,
  viajesNueva,
  viajesLoading,
  onClose,
  onSave,
  saving = false,
  error = null,
  showComprobanteAdjunto = false,
  hasArca = false,
  tenantId,
  getToken: getTokenProp,
  facturasCreateUrl,
  onFacturaGuardada,
  onFacturaEmitida,
}: FacturaCreateModalProps) {
  const auth = useAuth();
  const getToken = getTokenProp ?? auth.getToken;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const platform = Boolean(tenantId?.trim());
  const unifiedArca =
    hasArca && Boolean(getToken) && Boolean(facturasCreateUrl);

  const [submitAction, setSubmitAction] = useState<
    "borrador" | "emitir" | null
  >(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "autorizada">("form");

  // Las líneas ahora son derivadas y estrictamente de solo lectura
  const lineas = useMemo(
    () => defaultFacturaLineasFromDraft(draft, viajes),
    [draft, viajes],
  );

  const [lineasIncomplete, setLineasIncomplete] = useState<number[]>([]);
  const [tramosIncomplete, setTramosIncomplete] = useState<number[]>([]);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);
  const [datosReady, setDatosReady] = useState(false);
  const [arcaConfigMissing, setArcaConfigMissing] = useState(false);
  const [facturaEmitida, setFacturaEmitida] = useState<Factura | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [previewComprobanteUrl, setPreviewComprobanteUrl] = useState<
    string | null
  >(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const busy = saving || submitAction != null;
  const displayError = unifiedArca ? localError : localError || error;

  useEscapeKey(open, busy, onClose);

  const configUrl = platform
    ? `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId!)}`
    : "/api/integracion-arca/config";

  const ivaPctDefault =
    draft.ivaPct.trim() !== ""
      ? Number(draft.ivaPct)
      : (arcaConfig?.ivaGastosAdmin ?? 21);

  const bloqueadoUsd = useMemo(() => {
    if (!hasArca) return false;
    const moneda = monedaUnicaDeViajes(draft.viajeIds, viajes);
    return moneda != null && arcaBloqueaFacturarUsd(true, moneda);
  }, [hasArca, draft.viajeIds, viajes]);

  const missingEmitFields = useMemo(
    () =>
      collectFacturaEmitMissingFields({
        emisor: arcaConfig,
        cliente: clienteDetalle ?? {
          nombre: null,
          direccion: null,
          idFiscal: null,
          condicionIva: null,
        },
      }),
    [arcaConfig, clienteDetalle],
  );
  const missingEmitMessage = formatFacturaEmitMissingMessage(missingEmitFields);
  const datosEmitIncompletos = datosReady && missingEmitFields.length > 0;
  const sinConfigArca = datosReady && !arcaConfig;

  const totales = useMemo(
    () => computeFacturaTotales(lineas, ivaPctDefault),
    [lineas, ivaPctDefault],
  );

  const condicionIva = clienteDetalle?.condicionIva ?? null;
  const letra = facturaLetraFromCondicionIva(condicionIva);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setSubmitAction(null);
      setLocalError(null);
      setLineasIncomplete([]);
      setTramosIncomplete([]);
      setArcaConfigMissing(false);
      setFacturaEmitida(null);
      setPreviewComprobanteUrl(null);
      return;
    }
    if (!unifiedArca) return;

    let cancelled = false;
    setDatosReady(false);
    setClienteDetalle(
      draft.clienteId
        ? (clientes.find((c) => c.id === draft.clienteId) ?? null)
        : null,
    );

    void (async () => {
      try {
        const cfg = await apiJson<ArcaConfig | null>(configUrl, () =>
          getToken(),
        );
        if (!cancelled) setArcaConfig(cfg);
      } catch {
        if (!cancelled) setArcaConfig(null);
      }

      if (draft.clienteId) {
        try {
          const url = platform
            ? `/api/platform/clientes/${encodeURIComponent(draft.clienteId)}?tenantId=${encodeURIComponent(tenantId!)}`
            : `/api/clientes/${encodeURIComponent(draft.clienteId)}`;
          const c = await apiJson<Cliente>(url, () => getToken());
          if (!cancelled) setClienteDetalle(c);
        } catch {
          /* se valida con lo disponible */
        }
      } else if (!cancelled) {
        setClienteDetalle(null);
      }

      if (!cancelled) setDatosReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    unifiedArca,
    configUrl,
    draft.clienteId,
    clientes,
    getToken,
    platform,
    tenantId,
  ]);

  // Limpiar errores de línea cuando cambian las líneas derivadas
  useEffect(() => {
    setLineasIncomplete([]);
  }, [lineas]);

  if (!open) return null;

  function patch(p: Partial<FacturaDraft>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  function patchViajeIds(ids: string[]) {
    const tramos = filterFacturaTramosByViajeIds(draft.tramos, ids);
    const facturarPorTramo = ids.length === 0 ? false : draft.facturarPorTramo;
    patch({
      viajeIds: ids,
      facturarPorTramo,
      tramos: facturarPorTramo ? tramos : [],
    });
    setTramosIncomplete([]);
    setLocalError(null);
  }

  function handleToggleFacturarPorTramo(checked: boolean) {
    const ivaDefault =
      draft.ivaPct.trim() !== "" ? Number(draft.ivaPct) : ivaPctDefault;
    patch({
      facturarPorTramo: checked,
      tramos: checked
        ? draft.tramos.length > 0
          ? draft.tramos
          : [
              emptyFacturaTramoDraft(
                Number.isFinite(ivaDefault) ? ivaDefault : 21,
              ),
            ]
        : [],
    });
    setTramosIncomplete([]);
    setLocalError(null);
  }

  function notifyError(message: string) {
    setLocalError(message);
    showToast(message, "error");
    requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  async function resolveComprobanteUrl(): Promise<string | null | undefined> {
    if (!showComprobanteAdjunto) return undefined;
    if (draft.comprobanteFile) {
      return uploadComprobante(
        () => getToken(),
        draft.comprobanteFile,
        "facturacion",
      );
    }
    return draft.comprobanteUrl;
  }

  async function persistFactura(): Promise<Factura> {
    const comprobanteUrl = await resolveComprobanteUrl();
    return apiJson<Factura>(facturasCreateUrl!, () => getToken(), {
      method: "POST",
      body: JSON.stringify(facturaPayloadFromDraft(draft, comprobanteUrl)),
    });
  }

  async function handleUnifiedSubmit(action: "borrador" | "emitir") {
    if (busy) return;
    const validationError = validateFacturaDraft(draft, viajes, hasArca);
    if (validationError) {
      notifyError(validationError);
      return;
    }
    const tramosCheck = validateFacturaDraftTramos(draft);
    if (!tramosCheck.ok) {
      setTramosIncomplete(tramosCheck.indices);
      notifyError(tramosCheck.message);
      return;
    }

    if (action === "emitir") {
      if (bloqueadoUsd) {
        notifyError(MSG_ARCA_NO_FACTURA_USD);
        return;
      }
      if (!datosReady) {
        notifyError(
          "Cargando datos de emisión. Intentá de nuevo en un momento.",
        );
        return;
      }
      if (sinConfigArca) {
        setArcaConfigMissing(true);
        notifyError(
          platform
            ? "Este tenant no tiene configuración ARCA. Configurala en Superadmin → ARCA / AFIP."
            : "No hay configuración ARCA para este tenant. Completala en Configuración ARCA.",
        );
        return;
      }
      if (datosEmitIncompletos) {
        notifyError(missingEmitMessage ?? "Faltan datos para emitir.");
        return;
      }
      const lineasCheck = validateFacturaLineasDraft(lineas);
      if (!lineasCheck.ok) {
        setLineasIncomplete(lineasCheck.indices);
        notifyError(lineasCheck.message);
        return;
      }
    }

    setLineasIncomplete([]);
    setTramosIncomplete([]);
    setLocalError(null);
    setSubmitAction(action);

    try {
      const factura = await persistFactura();

      if (action === "borrador") {
        showToast("Factura guardada como borrador.", "success");
        onFacturaGuardada?.(factura);
        onClose();
        return;
      }

      const emitUrl = platform
        ? `/api/platform/arca/facturas/${encodeURIComponent(factura.id)}/emitir?tenantId=${encodeURIComponent(tenantId!)}`
        : `/api/integracion-arca/facturas/${encodeURIComponent(factura.id)}/emitir`;

      const updated = await apiJson<Factura>(emitUrl, () => getToken(), {
        method: "POST",
        body: JSON.stringify({ lineas: toFacturaLineasPayload(lineas) }),
      });

      setFacturaEmitida(updated);
      setStep("autorizada");
      onFacturaEmitida?.(updated);
      showToast("Factura emitida a ARCA.", "success");
    } catch (err) {
      const msg =
        action === "emitir" &&
        err instanceof ApiError &&
        err.status === 404 &&
        err.message?.toLowerCase().includes("arca")
          ? err.message
          : friendlyError(err, action === "emitir" ? "arca" : "facturacion");
      if (
        action === "emitir" &&
        err instanceof ApiError &&
        err.status === 404 &&
        err.message?.toLowerCase().includes("arca")
      ) {
        setArcaConfigMissing(true);
      } else {
        setArcaConfigMissing(false);
      }
      notifyError(msg);
    } finally {
      setSubmitAction(null);
    }
  }

  async function descargarPdf() {
    if (!facturaEmitida) return;
    const pdfUrl = platform
      ? `/api/platform/arca/facturas/${encodeURIComponent(facturaEmitida.id)}/pdf?tenantId=${encodeURIComponent(tenantId!)}`
      : `/api/integracion-arca/facturas/${encodeURIComponent(facturaEmitida.id)}/pdf`;
    setDownloading(true);
    try {
      const res = await apiFetch(pdfUrl, () => getToken());
      if (!res.ok) throw new Error("Error al generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${facturaEmitida.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLocalError(friendlyError(err, "arca"));
    } finally {
      setDownloading(false);
    }
  }

  const monedaInvalida =
    draft.viajeIds.length > 0 &&
    monedaUnicaDeViajes(draft.viajeIds, viajes) === null;

  const compactFields = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {!hasArca && (
          <div className="flex flex-col gap-1">
            <label className={compactLabelClass}>
              Número <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={draft.numero}
              onChange={(e) => patch({ numero: e.target.value })}
              placeholder="0001-00000001"
              className={compactInputClass}
            />
          </div>
        )}
        <FacturaContraparteField
          tipo={draft.tipo}
          clienteId={draft.clienteId}
          transportistaId={draft.transportistaId}
          clientes={clientes}
          transportistas={transportistas}
          onClienteChange={(id) =>
            patch({
              clienteId: id,
              viajeIds: [],
              facturarPorTramo: false,
              tramos: [],
            })
          }
          onTransportistaChange={(id) =>
            patch({
              transportistaId: id,
              viajeIds: [],
              facturarPorTramo: false,
              tramos: [],
            })
          }
          compact
        />
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <div className="flex flex-col gap-1">
            <label className={compactLabelClass}>
              Fecha de emisión <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={draft.fechaEmision}
              onChange={(e) => patch({ fechaEmision: e.target.value })}
              className={compactInputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={compactLabelClass}>Fecha de vencimiento</label>
            <input
              type="date"
              value={draft.fechaVencimiento}
              onChange={(e) => patch({ fechaVencimiento: e.target.value })}
              className={compactInputClass}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className={compactLabelClass}>
            {draft.facturarPorTramo ? "IVA (%) viajes sin tramo" : "IVA (%)"}
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={draft.ivaPct}
            onChange={(e) => patch({ ivaPct: e.target.value })}
            placeholder="21"
            className={`${compactInputClass} sm:max-w-[8rem]`}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        <div className="flex shrink-0 items-baseline justify-between gap-2">
          <label className={compactLabelClass}>
            Viajes vinculados{" "}
            {draft.viajeIds.length > 0 && `(${draft.viajeIds.length})`}
          </label>
          {draft.viajeIds.length > 0 && (
            <span className="text-xs font-medium tabular-nums text-vialto-charcoal">
              {textoImporteFacturaSeleccion(draft.viajeIds, viajes, draft.tipo)}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ViajesVinculadosEditor
            viajes={viajes}
            disponibles={viajesNueva}
            selected={draft.viajeIds}
            onChange={patchViajeIds}
            loading={viajesLoading}
            tipo={draft.tipo}
            clienteId={draft.clienteId}
            transportistaId={draft.transportistaId}
            viajesTablaFillHeight
          />
        </div>
      </div>
      {draft.viajeIds.length > 0 && (
        <label className="inline-flex items-center gap-2 text-xs text-vialto-charcoal">
          <input
            type="checkbox"
            checked={draft.facturarPorTramo}
            disabled={busy}
            onChange={(e) => handleToggleFacturarPorTramo(e.target.checked)}
            className="h-4 w-4 border-black/20"
          />
          Facturar por tramo
        </label>
      )}
      {draft.facturarPorTramo && draft.viajeIds.length > 0 && (
        <FacturaTramosEditor
          tramos={draft.tramos}
          onChange={(tramos) => {
            patch({ tramos });
            setTramosIncomplete([]);
            setLocalError(null);
          }}
          viajeIds={draft.viajeIds}
          viajes={viajes}
          ivaPctDefault={ivaPctDefault}
          disabled={busy}
          incompleteIndices={tramosIncomplete}
        />
      )}
      <FacturaTotalesPreview draft={draft} viajes={viajes} />
      {monedaInvalida && (
        <p className="shrink-0 rounded border border-red-300/80 bg-red-50 px-3 py-2 text-xs text-red-700">
          Los viajes seleccionados tienen distintas monedas. Una factura no
          puede contener viajes en distintas monedas. Generá una factura por
          moneda.
        </p>
      )}
    </div>
  );

  const standardFields = (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Número <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={draft.numero}
            onChange={(e) => patch({ numero: e.target.value })}
            placeholder="0001-00000001"
            className="h-9 border border-black/20 bg-white px-3 text-sm"
          />
        </div>
        <FacturaContraparteField
          tipo={draft.tipo}
          clienteId={draft.clienteId}
          transportistaId={draft.transportistaId}
          clientes={clientes}
          transportistas={transportistas}
          onClienteChange={(id) =>
            patch({
              clienteId: id,
              viajeIds: [],
              facturarPorTramo: false,
              tramos: [],
            })
          }
          onTransportistaChange={(id) =>
            patch({
              transportistaId: id,
              viajeIds: [],
              facturarPorTramo: false,
              tramos: [],
            })
          }
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Fecha de emisión <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={draft.fechaEmision}
            onChange={(e) => patch({ fechaEmision: e.target.value })}
            className="h-9 border border-black/20 bg-white px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Fecha de vencimiento
          </label>
          <input
            type="date"
            value={draft.fechaVencimiento}
            onChange={(e) => patch({ fechaVencimiento: e.target.value })}
            className="h-9 border border-black/20 bg-white px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            {draft.facturarPorTramo ? "IVA (%) viajes sin tramo" : "IVA (%)"}
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={draft.ivaPct}
            onChange={(e) => patch({ ivaPct: e.target.value })}
            placeholder="21"
            className="h-9 border border-black/20 bg-white px-3 text-sm"
          />
        </div>
        <div className="col-span-full flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
              Viajes vinculados{" "}
              {draft.viajeIds.length > 0 && `(${draft.viajeIds.length})`}
            </label>
            {draft.viajeIds.length > 0 && (
              <span className="text-sm font-medium tabular-nums text-vialto-charcoal">
                {textoImporteFacturaSeleccion(
                  draft.viajeIds,
                  viajes,
                  draft.tipo,
                )}
              </span>
            )}
          </div>
          <ViajesVinculadosEditor
            viajes={viajes}
            disponibles={viajesNueva}
            selected={draft.viajeIds}
            onChange={patchViajeIds}
            loading={viajesLoading}
            tipo={draft.tipo}
            clienteId={draft.clienteId}
            transportistaId={draft.transportistaId}
          />
        </div>
        {draft.viajeIds.length > 0 && (
          <div className="col-span-full">
            <label className="inline-flex items-center gap-2 text-sm text-vialto-charcoal">
              <input
                type="checkbox"
                checked={draft.facturarPorTramo}
                disabled={busy}
                onChange={(e) => handleToggleFacturarPorTramo(e.target.checked)}
                className="h-4 w-4 border-black/20"
              />
              Facturar por tramo
            </label>
          </div>
        )}
        {draft.facturarPorTramo && draft.viajeIds.length > 0 && (
          <div className="col-span-full">
            <FacturaTramosEditor
              tramos={draft.tramos}
              onChange={(tramos) => {
                patch({ tramos });
                setTramosIncomplete([]);
                setLocalError(null);
              }}
              viajeIds={draft.viajeIds}
              viajes={viajes}
              ivaPctDefault={
                draft.ivaPct.trim() !== "" ? Number(draft.ivaPct) : 21
              }
              disabled={busy}
              incompleteIndices={tramosIncomplete}
            />
          </div>
        )}
      </div>
      <FacturaTotalesPreview draft={draft} viajes={viajes} />
      {monedaInvalida && (
        <p className="mt-3 rounded border border-red-300/80 bg-red-50 px-3 py-2 text-xs text-red-700">
          Los viajes seleccionados tienen distintas monedas. Una factura no
          puede contener viajes en distintas monedas. Generá una factura por
          moneda.
        </p>
      )}
      {showComprobanteAdjunto && (
        <div className="mt-4">
          <ComprobanteAdjuntoField
            file={draft.comprobanteFile}
            existingUrl={draft.comprobanteUrl}
            onFileChange={(file) =>
              patch(
                file
                  ? { comprobanteFile: file, comprobanteUrl: null }
                  : { comprobanteFile: null },
              )
            }
            onClearExisting={() =>
              patch({ comprobanteUrl: null, comprobanteFile: null })
            }
            disabled={busy}
          />
        </div>
      )}
    </>
  );

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-[110] flex justify-center sm:items-center sm:p-4 md:p-6",
          step === "autorizada" ? "items-center" : "items-stretch",
        ].join(" ")}
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Cerrar"
          disabled={busy}
          onClick={() => {
            if (!busy) onClose();
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="factura-create-modal-title"
          className={[
            "relative flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:rounded-lg sm:border sm:border-black/15",
            step === "autorizada" ? "h-auto" : "h-full",
            step === "autorizada"
              ? "sm:h-auto"
              : unifiedArca
                ? "sm:h-[92vh]"
                : "sm:h-auto sm:max-h-[92vh]",
            step === "autorizada"
              ? "max-w-[min(34rem,calc(100vw-1rem))]"
              : unifiedArca
                ? "max-w-[min(90rem,calc(100vw-1rem))]"
                : "max-w-[min(72rem,calc(100vw-1rem))]",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2
                id="factura-create-modal-title"
                className="text-base font-semibold text-vialto-charcoal"
              >
                {step === "autorizada" ? (
                  "Factura emitida"
                ) : (
                  <>
                    Nueva factura
                    {draft.letraComprobante === "a"
                      ? " A"
                      : draft.letraComprobante === "b"
                        ? " B"
                        : ""}
                  </>
                )}
              </h2>
              <p className="mt-1 text-xs text-vialto-steel">
                {step === "autorizada" ? (
                  "El comprobante fue autorizado por ARCA."
                ) : (
                  <>
                    {unifiedArca
                      ? "Completá los datos a la izquierda y revisá el comprobante en tiempo real a la derecha."
                      : "Completá los datos y opcionalmente vinculá viajes a esta factura."}
                    {draft.letraComprobante
                      ? ` Tipo elegido: Factura ${draft.letraComprobante.toUpperCase()}.`
                      : ""}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          <div
            className={[
              "min-h-0 flex-1 overflow-hidden",
              step === "form" && unifiedArca
                ? "flex flex-col lg:min-h-0 lg:flex-row"
                : "overflow-y-auto",
            ].join(" ")}
          >
            {step === "form" ? (
              unifiedArca ? (
                <>
                  <div className="flex min-h-0 flex-col overflow-y-auto border-b border-black/10 px-4 py-4 sm:px-5 lg:w-[60%] lg:max-w-[60%] lg:shrink-0 lg:overflow-hidden lg:border-b-0 lg:border-r">
                    {compactFields}
                  </div>
                  <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:w-[40%] lg:max-w-[40%] lg:shrink-0 lg:min-w-0">
                    <FacturaArcaPreviewPanel
                      arcaConfig={arcaConfig}
                      clienteDetalle={clienteDetalle}
                      datosReady={datosReady}
                      numero={draft.numero}
                      fechaEmision={draft.fechaEmision}
                      lineas={lineas}
                      onLineasChange={() => {}} /* Bloqueado, las líneas son fijas */
                      ivaPctDefault={ivaPctDefault}
                      lineasIncomplete={lineasIncomplete}
                      lineasDisabled={
                        true
                      } /* Forzamos a deshabilitar edición interna */
                      bloqueadoUsd={bloqueadoUsd}
                      missingEmitFields={missingEmitFields}
                      sinConfigArca={sinConfigArca}
                      datosEmitIncompletos={datosEmitIncompletos}
                      platform={platform}
                      tenantId={tenantId}
                      getToken={getToken}
                      onClienteUpdated={setClienteDetalle}
                      feedbackSlot={
                        <div ref={feedbackRef} className="space-y-2">
                          {displayError && (
                            <CrudFormErrorAlert message={displayError} />
                          )}
                          {arcaConfigMissing && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                navigate(
                                  platform
                                    ? "/superadmin/arca"
                                    : "/configuracion/arca",
                                );
                              }}
                              className="w-full h-9 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                            >
                              {platform
                                ? "Ir a ARCA / AFIP (superadmin)"
                                : "Ir a configuración de ARCA"}
                            </button>
                          )}
                        </div>
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                  {standardFields}
                  {displayError && (
                    <div className="mt-4">
                      <CrudFormErrorAlert message={displayError} />
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="overflow-y-auto px-4 py-5 sm:px-6">
                <div className="mx-auto max-w-lg space-y-5">
                  <div className="border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-medium text-emerald-800">
                      Comprobante autorizado por ARCA
                    </p>
                    {facturaEmitida?.cae && (
                      <p className="text-xs text-emerald-700 mt-0.5">
                        CAE: {facturaEmitida.cae}
                      </p>
                    )}
                    {facturaEmitida?.caeFechaVto && (
                      <p className="text-xs text-emerald-700">
                        Vto. CAE: {fmtPreviewDate(facturaEmitida.caeFechaVto)}
                      </p>
                    )}
                  </div>
                  <section className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Resumen
                    </p>
                    <div className="flex justify-between text-xs">
                      <span className="text-vialto-steel">Tipo</span>
                      <span className="tabular-nums text-vialto-charcoal">
                        {facturaLetraLabel(letra)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-vialto-steel">Cliente</span>
                      <span className="tabular-nums text-vialto-charcoal">
                        {clienteDetalle?.nombre ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-vialto-steel">Neto</span>
                      <span className="tabular-nums text-vialto-charcoal">
                        {fmtPreviewMoney(totales.neto)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-vialto-steel">IVA</span>
                      <span className="tabular-nums text-vialto-charcoal">
                        {fmtPreviewMoney(totales.iva)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-vialto-charcoal border-t border-black/10 pt-1.5 mt-0.5">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {fmtPreviewMoney(totales.total)}
                      </span>
                    </div>
                  </section>
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={() => void descargarPdf()}
                      className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                    >
                      {downloading ? "Generando…" : "Descargar PDF"}
                    </button>
                    {facturaEmitida?.comprobanteUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewComprobanteUrl(
                            facturaEmitida.comprobanteUrl!,
                          )
                        }
                        className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                      >
                        Ver comprobante
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {step === "form" && (
            <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-60"
              >
                Cancelar
              </button>
              {unifiedArca ? (
                <>
                  <button
                    type="button"
                    disabled={busy || monedaInvalida}
                    onClick={() => void handleUnifiedSubmit("borrador")}
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-60"
                  >
                    {submitAction === "borrador" && (
                      <Spinner className="h-3.5 w-3.5" />
                    )}
                    {submitAction === "borrador"
                      ? "Guardando…"
                      : "Guardar borrador"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      monedaInvalida ||
                      bloqueadoUsd ||
                      datosEmitIncompletos
                    }
                    onClick={() => void handleUnifiedSubmit("emitir")}
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
                  >
                    {submitAction === "emitir" ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Receipt
                        className="h-3.5 w-3.5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    )}
                    {submitAction === "emitir"
                      ? "Emitiendo a ARCA…"
                      : !datosReady
                        ? "Cargando datos…"
                        : "Emitir a ARCA"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const tramosCheck = validateFacturaDraftTramos(draft);
                    if (!tramosCheck.ok) {
                      setTramosIncomplete(tramosCheck.indices);
                      setLocalError(tramosCheck.message);
                      return;
                    }
                    setTramosIncomplete([]);
                    onSave?.();
                  }}
                  disabled={busy || monedaInvalida}
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
                >
                  {busy && <Spinner className="h-3.5 w-3.5" />}
                  {busy ? "Guardando…" : "Guardar"}
                </button>
              )}
            </footer>
          )}
        </div>
      </div>

      {previewComprobanteUrl && (
        <AdjuntoPreviewModal
          url={previewComprobanteUrl}
          title="Comprobante"
          onClose={() => setPreviewComprobanteUrl(null)}
        />
      )}
    </>
  );
}
