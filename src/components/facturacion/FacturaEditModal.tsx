import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import {
  ClienteSearchSelect,
  TransportistaSearchSelect,
} from "@/components/forms/MaestroSearchSelects";
import {
  FacturaTramosEditor,
  computeTotalesFacturaPorTramo,
  emptyFacturaTramoDraft,
  toFacturaTramosPayload,
  validateFacturaTramosDraft,
  type FacturaTramoDraft,
} from "@/components/facturacion/FacturaTramosEditor";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { ViajesSeleccionTabla } from "@/components/shared/ViajesSeleccionTabla";
import { Spinner } from "@/components/ui/Spinner";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import {
  monedaUnicaDeViajes,
  textoImporteFacturaSeleccion,
  textoMontoFacturarListado,
} from "@/lib/viajesFlota";
import type { Cliente, Factura, Transportista, Viaje } from "@/types/api";

const ESTADO_LABEL: Record<string, string> = {
  borrador: "BORRADOR",
  esperando_afip: "ESPERANDO AFIP",
  facturado: "FACTURADO",
  error_afip: "ERROR DE AFIP",
  anulado: "ANULADO",
};

/** Badge adicional de cobro — se muestra junto al de ciclo de vida, nunca lo reemplaza. */
const COBRADO_BADGE_CLASS = "bg-emerald-200 text-emerald-950 border-emerald-600/90";
const VENCIDA_BADGE_CLASS = "bg-orange-100 text-orange-950 border-orange-400/80";

const ESTADO_BADGE: Record<string, string> = {
  borrador: "bg-zinc-100 text-zinc-800 border-zinc-300/90",
  esperando_afip: "bg-amber-50 text-amber-950 border-amber-200/95",
  facturado: "bg-emerald-100 text-emerald-950 border-emerald-500/80",
  error_afip: "bg-red-100 text-red-950 border-red-400/80",
  anulado: "bg-gray-100 text-gray-500 border-gray-300/80 line-through",
};

export type FacturaDraft = {
  numero: string;
  tipo: "cliente" | "transportista_externo";
  clienteId: string;
  transportistaId: string;
  viajeIds: string[];
  fechaEmision: string;
  fechaVencimiento: string;
  ivaPct: string;
  facturarPorTramo: boolean;
  tramos: FacturaTramoDraft[];
  /** Letra AFIP elegida al facturar desde un viaje (A o B). */
  letraComprobante?: "a" | "b" | null;
  /** URL ya guardada (edición) o vacía si se quitó. */
  comprobanteUrl: string | null;
  /** Archivo local pendiente de subir. */
  comprobanteFile: File | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDate(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function emptyFacturaDraft(): FacturaDraft {
  return {
    numero: "",
    tipo: "cliente",
    clienteId: "",
    transportistaId: "",
    viajeIds: [],
    fechaEmision: todayIso(),
    fechaVencimiento: "",
    ivaPct: "21",
    facturarPorTramo: false,
    tramos: [],
    letraComprobante: null,
    comprobanteUrl: null,
    comprobanteFile: null,
  };
}

/** Filtra tramos huérfanos al cambiar los viajes vinculados. */
export function filterFacturaTramosByViajeIds(
  tramos: FacturaTramoDraft[],
  viajeIds: string[],
): FacturaTramoDraft[] {
  const allowed = new Set(viajeIds);
  return tramos.filter((t) => !t.viajeId || allowed.has(t.viajeId));
}

export function validateFacturaDraftTramos(
  draft: FacturaDraft,
): { ok: true } | { ok: false; message: string; indices: number[] } {
  if (!draft.facturarPorTramo) return { ok: true };
  return validateFacturaTramosDraft(draft.tramos, draft.viajeIds);
}

/** Payload para POST/PATCH de factura a partir del draft del formulario (crear y editar). */
export function facturaPayloadFromDraft(
  draft: FacturaDraft,
  comprobanteUrl?: string | null,
) {
  const ivaN = draft.ivaPct.trim() !== "" ? Number(draft.ivaPct) : undefined;
  const facturarPorTramo =
    draft.facturarPorTramo && draft.viajeIds.length > 0;
  const base: Record<string, unknown> = {
    numero: draft.numero.trim() || undefined,
    tipo: "cliente",
    viajeIds: draft.viajeIds,
    fechaEmision: draft.fechaEmision,
    fechaVencimiento: draft.fechaVencimiento || undefined,
    ivaPct: ivaN,
    facturarPorTramo,
    tramos: facturarPorTramo
      ? toFacturaTramosPayload(draft.tramos)
      : [],
  };
  if (comprobanteUrl !== undefined) {
    base.comprobanteUrl = comprobanteUrl ?? "";
  }
  return {
    ...base,
    clienteId: draft.clienteId || undefined,
    transportistaId: undefined,
  };
}

export function facturaToEditDraft(f: Factura): FacturaDraft {
  const ivaPct = f.ivaPct != null ? String(f.ivaPct) : "21";
  const ivaDefault = f.ivaPct ?? 21;
  const tramos: FacturaTramoDraft[] = (f.tramos ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((t) => ({
      viajeId: t.viajeId,
      detalle: t.detalle,
      monto: t.monto,
      montoStr: t.monto > 0 ? String(t.monto) : "",
      ivaPct: t.ivaPct,
      ivaPctStr: String(t.ivaPct),
    }));
  return {
    numero: f.numero ?? "",
    tipo: f.tipo,
    clienteId: f.clienteId ?? "",
    transportistaId: f.transportistaId ?? "",
    viajeIds: f.viajeIds,
    fechaEmision: isoToDate(f.fechaEmision),
    fechaVencimiento: isoToDate(f.fechaVencimiento),
    ivaPct,
    facturarPorTramo: Boolean(f.facturarPorTramo),
    tramos:
      f.facturarPorTramo && tramos.length > 0
        ? tramos
        : f.facturarPorTramo
          ? [emptyFacturaTramoDraft(ivaDefault)]
          : [],
    comprobanteUrl: f.comprobanteUrl ?? null,
    comprobanteFile: null,
  };
}

function fmtTotalesMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Neto (sin IVA) + total con IVA para modo simple o por tramo. */
export function FacturaTotalesPreview({
  draft,
  viajes,
}: {
  draft: FacturaDraft;
  viajes: Viaje[];
}) {
  const ivaN = draft.ivaPct.trim() !== "" ? Number(draft.ivaPct) : 0;
  const totales = (() => {
    if (draft.facturarPorTramo && draft.viajeIds.length > 0) {
      return computeTotalesFacturaPorTramo(
        draft.viajeIds,
        viajes,
        draft.tramos,
        Number.isFinite(ivaN) ? ivaN : 0,
      );
    }
    const neto =
      draft.viajeIds.length > 0
        ? draft.viajeIds.reduce((sum, id) => {
            const v = viajes.find((x) => x.id === id);
            return sum + (v?.monto ?? 0);
          }, 0)
        : 0;
    const iva = neto * ((Number.isFinite(ivaN) ? ivaN : 0) / 100);
    return { neto, iva, total: neto + iva };
  })();

  if (totales.neto <= 0 && totales.total <= 0) return null;

  return (
    <div className="mt-3 space-y-1 text-xs text-right text-vialto-steel">
      <p>
        Neto (sin IVA):{" "}
        <span className="font-medium tabular-nums text-vialto-charcoal">
          {fmtTotalesMoney(totales.neto)}
        </span>
      </p>
      <p>
        Total con IVA:{" "}
        <span className="font-medium tabular-nums text-vialto-charcoal">
          {fmtTotalesMoney(totales.total)}
        </span>
      </p>
    </div>
  );
}

/** Al cambiar el tipo de factura, preserva el viaje actual y actualiza la contraparte según el tipo. Si no hay viaje previo, limpia todo. */
export function patchFacturaTipo(
  tipo: FacturaDraft["tipo"],
  viajeActual?: Viaje | null,
): Pick<FacturaDraft, "tipo" | "clienteId" | "transportistaId" | "viajeIds"> {
  if (tipo === "transportista_externo" && viajeActual) {
    return {
      tipo,
      clienteId: "",
      transportistaId: viajeActual.transportistaId ?? "",
      viajeIds: [viajeActual.id],
    };
  }
  if (tipo === "cliente" && viajeActual) {
    return {
      tipo,
      clienteId: viajeActual.clienteId ?? "",
      transportistaId: "",
      viajeIds: [viajeActual.id],
    };
  }
  return { tipo, clienteId: "", transportistaId: "", viajeIds: [] };
}

const clienteInputClass =
  "h-9 w-full border border-black/15 bg-white px-2 text-sm";

const compactInputClass =
  "h-8 w-full border border-black/15 bg-white px-2 text-sm";

const compactLabelClass =
  "text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel";

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
  const inputClass = compact ? compactInputClass : clienteInputClass;

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

// ─── viajes vinculados editor ─────────────────────────────────────────────────

export function ViajesVinculadosEditor({
  viajes,
  disponibles,
  selected,
  onChange,
  loading,
  tipo,
  clienteId,
  transportistaId,
  viajesTablaFillHeight = false,
}: {
  viajes: Viaje[];
  disponibles: Viaje[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  tipo: FacturaDraft["tipo"];
  clienteId: string;
  transportistaId: string;
  viajesTablaFillHeight?: boolean;
}) {
  const showClienteHint = tipo === "cliente" && !clienteId.trim();
  const showTransportistaHint =
    tipo === "transportista_externo" && !transportistaId.trim();
  const showContraparteHint = showClienteHint || showTransportistaHint;

  // Candidatos filtrados + los ya seleccionados que hayan quedado fuera del filtro actual.
  const pool = useMemo(() => {
    const porId = new Map<string, Viaje>();
    for (const v of disponibles) porId.set(v.id, v);
    for (const id of selected) {
      if (!porId.has(id)) {
        const v = viajes.find((x) => x.id === id);
        if (v) porId.set(id, v);
      }
    }
    return Array.from(porId.values());
  }, [disponibles, selected, viajes]);

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  if (showContraparteHint) {
    return (
      <p className="text-[11px] text-vialto-steel">
        {showTransportistaHint
          ? "Elegí un transportista para poder vincular viajes."
          : "Elegí un cliente para poder vincular viajes."}
      </p>
    );
  }

  if (viajesTablaFillHeight) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ViajesSeleccionTabla
          viajes={pool}
          selectedIds={selected}
          onToggle={toggle}
          renderMonto={(v) => textoMontoFacturarListado(v)}
          loading={loading}
          fillHeight
          emptyMessage="No hay viajes disponibles para vincular."
        />
      </div>
    );
  }

  return (
    <ViajesSeleccionTabla
      viajes={pool}
      selectedIds={selected}
      onToggle={toggle}
      renderMonto={(v) => textoMontoFacturarListado(v)}
      loading={loading}
      maxHeightClass="max-h-72"
      emptyMessage="No hay viajes disponibles para vincular."
    />
  );
}

// ─── shared hook ─────────────────────────────────────────────────────────────

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

// ─── create modal ─────────────────────────────────────────────────────────────

// ─── edit modal ───────────────────────────────────────────────────────────────

export type FacturaEditModalProps = {
  open: boolean;
  draft: FacturaDraft;
  setDraft: Dispatch<SetStateAction<FacturaDraft | null>>;
  snapshotFactura: Factura;
  clientes: Cliente[];
  transportistas: Transportista[];
  /** Listado completo de viajes (para sumar importes de los seleccionados). */
  viajes: Viaje[];
  /** Viajes mostrados en los checkboxes (filtrados por cliente/tipo/edición). */
  viajesEdicion: Viaje[];
  viajesLoading: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  showComprobanteAdjunto?: boolean;
};

export function FacturaEditModal({
  open,
  draft,
  setDraft,
  snapshotFactura,
  clientes,
  transportistas,
  viajes,
  viajesEdicion,
  viajesLoading,
  onClose,
  onSave,
  saving,
  error,
  showComprobanteAdjunto = false,
}: FacturaEditModalProps) {
  useEscapeKey(open, saving, onClose);
  const [tramosIncomplete, setTramosIncomplete] = useState<number[]>([]);
  const [tramosLocalError, setTramosLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTramosIncomplete([]);
      setTramosLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  function patch(p: Partial<FacturaDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
  }

  function patchViajeIds(ids: string[]) {
    const tramos = filterFacturaTramosByViajeIds(draft.tramos, ids);
    const facturarPorTramo =
      ids.length === 0 ? false : draft.facturarPorTramo;
    patch({
      viajeIds: ids,
      facturarPorTramo,
      tramos: facturarPorTramo ? tramos : [],
    });
    setTramosIncomplete([]);
    setTramosLocalError(null);
  }

  function handleToggleFacturarPorTramo(checked: boolean) {
    const ivaDefault =
      draft.ivaPct.trim() !== "" ? Number(draft.ivaPct) : 21;
    patch({
      facturarPorTramo: checked,
      tramos: checked
        ? draft.tramos.length > 0
          ? draft.tramos
          : [emptyFacturaTramoDraft(Number.isFinite(ivaDefault) ? ivaDefault : 21)]
        : [],
    });
    setTramosIncomplete([]);
    setTramosLocalError(null);
  }

  function handleSave() {
    const check = validateFacturaDraftTramos(draft);
    if (!check.ok) {
      setTramosIncomplete(check.indices);
      setTramosLocalError(check.message);
      return;
    }
    setTramosIncomplete([]);
    setTramosLocalError(null);
    onSave();
  }

  const ivaLabel = draft.facturarPorTramo
    ? "IVA (%) viajes sin tramo"
    : "IVA (%)";
  const displayError = tramosLocalError || error;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-stretch justify-center sm:items-center sm:p-4 md:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar edición"
        disabled={saving}
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="factura-edit-modal-title"
        className="relative flex h-full max-h-[100dvh] w-full max-w-[min(72rem,calc(100vw-1rem))] flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border sm:border-black/15"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="factura-edit-modal-title"
              className="truncate text-base font-semibold text-vialto-charcoal"
            >
              Editar factura {draft.numero}
            </h2>
            <p className="mt-1 text-xs text-vialto-steel">
              Estado de cobro según los viajes vinculados. Los demás datos se
              guardan al confirmar.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span
                className={[
                  "inline-block rounded border px-2 py-0.5 text-xs font-medium",
                  ESTADO_BADGE[snapshotFactura.estado] ?? "",
                ].join(" ")}
              >
                {ESTADO_LABEL[snapshotFactura.estado] ?? snapshotFactura.estado}
              </span>
              {snapshotFactura.cobrado ? (
                <span
                  className={[
                    "inline-block rounded border px-2 py-0.5 text-xs font-medium",
                    COBRADO_BADGE_CLASS,
                  ].join(" ")}
                >
                  COBRADO
                </span>
              ) : snapshotFactura.vencida ? (
                <span
                  className={[
                    "inline-block rounded border px-2 py-0.5 text-xs font-medium",
                    VENCIDA_BADGE_CLASS,
                  ].join(" ")}
                >
                  VENCIDA
                </span>
              ) : null}
              <AmbienteTestBadge ambiente={snapshotFactura.ambiente} />
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
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
                {ivaLabel}
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
                disponibles={viajesEdicion}
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
                    disabled={saving}
                    onChange={(e) =>
                      handleToggleFacturarPorTramo(e.target.checked)
                    }
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
                    setTramosLocalError(null);
                  }}
                  viajeIds={draft.viajeIds}
                  viajes={viajes}
                  ivaPctDefault={
                    draft.ivaPct.trim() !== "" ? Number(draft.ivaPct) : 21
                  }
                  disabled={saving}
                  incompleteIndices={tramosIncomplete}
                />
              </div>
            )}
          </div>

          <FacturaTotalesPreview draft={draft} viajes={viajes} />

          {draft.viajeIds.length > 0 &&
            monedaUnicaDeViajes(draft.viajeIds, viajes) === null && (
              <p className="mt-3 rounded border border-red-300/80 bg-red-50 px-3 py-2 text-xs text-red-700">
                Los viajes seleccionados tienen distintas monedas. Una factura
                no puede contener viajes en distintas monedas. Generá una
                factura por moneda.
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
                disabled={saving}
              />
            </div>
          )}

          {displayError && (
            <div className="mt-4">
              <CrudFormErrorAlert message={displayError} />
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              (draft.viajeIds.length > 0 &&
                monedaUnicaDeViajes(draft.viajeIds, viajes) === null)
            }
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
          >
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </footer>
      </div>
    </div>
  );
}
