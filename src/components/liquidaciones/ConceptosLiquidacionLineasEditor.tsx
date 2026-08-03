import { useCallback, useEffect, useRef, useState } from "react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { CrudFieldLabel } from "@/components/crud/CrudFields";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type {
  ConceptoLiquidacion,
  ConceptoLiquidacionSigno,
} from "@/types/api";

export type ConceptoLineaDraft = {
  conceptoLiquidacionId: string;
  monto: number;
  /**
   * Texto crudo del input de monto. Vacío al agregar una fila para no mostrar "0"
   * (si no, al tipear queda "0100"). Si falta, se deriva de `monto`.
   */
  montoStr?: string;
  nombre?: string;
  signo?: ConceptoLiquidacionSigno;
  ivaPct?: number;
  /**
   * ID del viaje al que corresponde este concepto.
   * Si es undefined, null o vacío "", se interpreta como un concepto "General".
   */
  viajeId?: string | null;
};

export interface ViajeOpcionDraft {
  id: string;
  numero: string | number;
}

const inputClass =
  "h-9 w-full rounded border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35";
const labelClass =
  "block font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel mb-1";

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signoLabel(s: ConceptoLiquidacionSigno) {
  return s === "favor" ? "A favor" : "En contra";
}

function signedMonto(
  signo: ConceptoLiquidacionSigno | undefined,
  monto: number,
) {
  if (!signo || !Number.isFinite(monto)) return 0;
  return signo === "favor" ? monto : -monto;
}

function montoStrFromNumber(monto: number): string {
  return Number.isFinite(monto) && monto > 0 ? String(monto) : "";
}

function parseMontoInput(raw: string): number {
  if (raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function displayMontoStr(linea: ConceptoLineaDraft): string {
  return linea.montoStr ?? montoStrFromNumber(linea.monto);
}

/** Una fila agregada cuenta como incompleta si falta concepto o el monto no es > 0. */
export function isConceptoLineaCompleta(l: ConceptoLineaDraft): boolean {
  return Boolean(l.conceptoLiquidacionId) && Number(l.monto) > 0;
}

export function findIncompleteConceptosLineas(
  lineas: ConceptoLineaDraft[],
): number[] {
  return lineas
    .map((l, i) => (isConceptoLineaCompleta(l) ? -1 : i))
    .filter((i) => i >= 0);
}

/** Bloquea guardar si hay filas agregadas sin completar (evita ignorarlas en silencio). */
export function validateConceptosLineasDraft(
  lineas: ConceptoLineaDraft[],
): { ok: true } | { ok: false; message: string; indices: number[] } {
  const indices = findIncompleteConceptosLineas(lineas);
  if (indices.length === 0) return { ok: true };
  const n = indices.length;
  return {
    ok: false,
    indices,
    message:
      n === 1
        ? "Hay un concepto incompleto. Completá el monto o quitalo antes de guardar."
        : `Hay ${n} conceptos incompletos. Completá el monto o quitalos antes de guardar.`,
  };
}

export function ConceptosLiquidacionLineasEditor({
  getToken,
  lineas,
  onChange,
  disabled,
  incompleteIndices,
  viajesDisponibles = [],
}: {
  getToken: () => Promise<string | null>;
  lineas: ConceptoLineaDraft[];
  onChange: (next: ConceptoLineaDraft[]) => void;
  disabled?: boolean;
  /** Índices de filas a marcar tras un intento de guardar con conceptos incompletos. */
  incompleteIndices?: number[];
  /** Viajes incluidos en la liquidación para permitir la asignación por línea. */
  viajesDisponibles?: ViajeOpcionDraft[];
}) {
  const incompleteSet = new Set(incompleteIndices ?? []);
  const [catalogo, setCatalogo] = useState<ConceptoLiquidacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(false);
  const [quickNombre, setQuickNombre] = useState("");
  const [quickSigno, setQuickSigno] =
    useState<ConceptoLiquidacionSigno>("favor");
  const [quickIva, setQuickIva] = useState("21");
  const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const showViajeSelector = viajesDisponibles.length > 1;

  const loadCatalogo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<ConceptoLiquidacion[]>(
        "/api/integracion-arca/conceptos-liquidacion?soloActivos=1",
        () => getTokenRef.current(),
      );
      setCatalogo(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(friendlyError(e, "arca"));
      setCatalogo([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalogo();
  }, [loadCatalogo]);

  function enrichFromCatalog(
    id: string,
    monto: number,
    montoStr?: string,
    viajeId?: string | null,
  ): ConceptoLineaDraft {
    const c = catalogo.find((x) => x.id === id);
    return {
      conceptoLiquidacionId: id,
      monto,
      montoStr: montoStr ?? montoStrFromNumber(monto),
      nombre: c?.nombre,
      signo: c?.signo,
      ivaPct: c?.ivaPct,
      viajeId: viajeId ?? null,
    };
  }

  function updateRow(index: number, patch: Partial<ConceptoLineaDraft>) {
    const next = lineas.map((l, i) => {
      if (i !== index) return l;
      const merged = { ...l, ...patch };
      if (patch.conceptoLiquidacionId != null) {
        return enrichFromCatalog(
          patch.conceptoLiquidacionId,
          merged.monto,
          merged.montoStr,
          merged.viajeId,
        );
      }
      return merged;
    });
    onChange(next);
  }

  function addRow() {
    if (catalogo.length === 0) {
      setShowQuick(true);
      return;
    }
    const usados = new Set(lineas.map((l) => l.conceptoLiquidacionId));
    const siguiente = catalogo.find((c) => !usados.has(c.id));
    if (!siguiente) {
      setShowQuick(true);
      return;
    }
    onChange([...lineas, enrichFromCatalog(siguiente.id, 0, "", null)]);
  }

  function removeRow(index: number) {
    onChange(lineas.filter((_, i) => i !== index));
  }

  function cancelQuick() {
    setShowQuick(false);
    setQuickNombre("");
    setQuickSigno("favor");
    setQuickIva("21");
    setQuickErrors({});
  }

  function onConceptoSelect(index: number, value: string) {
    if (value === "__nuevo__") {
      setShowQuick(true);
      return;
    }
    updateRow(index, { conceptoLiquidacionId: value });
  }

  async function handleQuickCreate(e?: React.SyntheticEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const errs: Record<string, string> = {};
    if (!quickNombre.trim()) errs.nombre = "Ingresá el nombre.";
    const iva = Number(quickIva);
    if (quickIva.trim() === "" || Number.isNaN(iva) || iva < 0 || iva > 100) {
      errs.ivaPct = "Ingresá un IVA entre 0 y 100.";
    }
    if (Object.keys(errs).length > 0) {
      setQuickErrors(errs);
      return;
    }
    setQuickErrors({});
    setCreating(true);
    setError(null);
    try {
      const created = await apiJson<ConceptoLiquidacion>(
        "/api/integracion-arca/conceptos-liquidacion",
        () => getTokenRef.current(),
        {
          method: "POST",
          body: JSON.stringify({
            nombre: quickNombre.trim(),
            signo: quickSigno,
            ivaPct: Number(quickIva),
          }),
        },
      );
      setCatalogo((prev) => [...prev, created]);
      onChange([
        ...lineas,
        {
          conceptoLiquidacionId: created.id,
          monto: 0,
          montoStr: "",
          nombre: created.nombre,
          signo: created.signo,
          ivaPct: created.ivaPct,
          viajeId: null,
        },
      ]);
      cancelQuick();
    } catch (err) {
      setError(friendlyError(err, "arca"));
    } finally {
      setCreating(false);
    }
  }

  const efectoNeto = lineas.reduce(
    (sum, l) => sum + signedMonto(l.signo, Number(l.monto) || 0),
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={labelClass + " mb-0"}>Conceptos de liquidación</p>
        {!disabled && (
          <button
            type="button"
            disabled={loading || showQuick}
            onClick={addRow}
            className="text-[10px] uppercase tracking-wider text-vialto-charcoal hover:text-vialto-fire disabled:opacity-50"
          >
            + Agregar concepto
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {showQuick && !disabled && (
        <div
          onKeyDown={(e) => {
            // Evita que presionar Enter dentro de los inputs envíe el modal padre
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              void handleQuickCreate(e);
            }
          }}
          className="space-y-3 border border-black/10 bg-vialto-mist/40 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-vialto-steel">
              Nuevo concepto rápido
            </p>
            <button
              type="button"
              onClick={cancelQuick}
              disabled={creating}
              aria-label="Cancelar alta de concepto"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-lg leading-none text-vialto-steel hover:text-vialto-charcoal disabled:opacity-50"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="grid gap-1">
              <CrudFieldLabel required>Nombre</CrudFieldLabel>
              <input
                value={quickNombre}
                onChange={(e) => setQuickNombre(e.target.value)}
                disabled={creating}
                className={`${inputClass} ${quickErrors.nombre ? "border-red-400" : ""}`}
              />
              <CrudFieldError message={quickErrors.nombre} />
            </label>
            <label className="grid gap-1">
              <CrudFieldLabel required>Signo</CrudFieldLabel>
              <select
                value={quickSigno}
                onChange={(e) =>
                  setQuickSigno(e.target.value as ConceptoLiquidacionSigno)
                }
                disabled={creating}
                className={inputClass}
              >
                <option value="favor">A favor</option>
                <option value="contra">En contra</option>
              </select>
            </label>
            <label className="grid gap-1">
              <CrudFieldLabel required>IVA (%)</CrudFieldLabel>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={quickIva}
                onChange={(e) => setQuickIva(e.target.value)}
                disabled={creating}
                className={`${inputClass} ${quickErrors.ivaPct ? "border-red-400" : ""}`}
              />
              <CrudFieldError message={quickErrors.ivaPct} />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={(e) => void handleQuickCreate(e)}
              disabled={creating}
              className="inline-flex items-center gap-2 h-8 px-3 rounded bg-vialto-charcoal text-[10px] uppercase tracking-wider text-white hover:bg-vialto-charcoal/90 disabled:opacity-50"
            >
              {creating && <Spinner className="h-3 w-3" />}
              {creating ? "Creando…" : "Crear y agregar"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-vialto-steel">
          <Spinner className="h-3.5 w-3.5" /> Cargando conceptos…
        </div>
      ) : lineas.length === 0 ? (
        <p className="text-xs text-vialto-steel">
          {catalogo.length > 0
            ? "Podés agregar conceptos precargados del catálogo (Configuración ARCA)."
            : "No hay conceptos precargados. Creá uno acá o en Configuración ARCA."}
        </p>
      ) : (
        <div className="space-y-2">
          {lineas.map((linea, index) => {
            const efecto = signedMonto(linea.signo, Number(linea.monto) || 0);
            const rowIncomplete = incompleteSet.has(index);
            const conceptoMissing =
              rowIncomplete && !linea.conceptoLiquidacionId;
            const montoMissing = rowIncomplete && !(Number(linea.monto) > 0);
            return (
              <div
                key={`${linea.conceptoLiquidacionId}-${index}`}
                className={`grid grid-cols-1 gap-2 border p-2 ${
                  showViajeSelector
                    ? "sm:grid-cols-[1fr_minmax(130px,180px)_7rem_auto]"
                    : "sm:grid-cols-[1fr_7rem_auto]"
                } sm:items-end ${
                  rowIncomplete ? "border-red-400" : "border-black/10"
                }`}
              >
                <label className="min-w-0">
                  <span className={labelClass}>
                    Concepto <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={linea.conceptoLiquidacionId}
                    disabled={disabled}
                    onChange={(e) => onConceptoSelect(index, e.target.value)}
                    className={`${inputClass} ${conceptoMissing ? "border-red-400" : ""}`}
                  >
                    {!catalogo.some(
                      (c) => c.id === linea.conceptoLiquidacionId,
                    ) &&
                      linea.conceptoLiquidacionId && (
                        <option value={linea.conceptoLiquidacionId}>
                          {linea.nombre ?? "Concepto"}
                        </option>
                      )}
                    {catalogo.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({signoLabel(c.signo)}, IVA {c.ivaPct}%)
                      </option>
                    ))}
                    <option value="__nuevo__">+ Crear concepto nuevo…</option>
                  </select>
                  <CrudFieldError
                    message={
                      conceptoMissing ? "Seleccioná un concepto." : undefined
                    }
                  />
                </label>

                {showViajeSelector && (
                  <label className="min-w-0">
                    <span className={labelClass}>Aplicar a</span>
                    <select
                      value={linea.viajeId ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRow(index, { viajeId: e.target.value || null })
                      }
                      className={inputClass}
                      title="Asignar concepto a un viaje o dejar como general"
                    >
                      <option value="">General (toda la liq.)</option>
                      {viajesDisponibles.map((v) => (
                        <option key={v.id} value={v.id}>
                          Viaje #{v.numero}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  <span className={labelClass}>
                    Monto <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={displayMontoStr(linea)}
                    disabled={disabled}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateRow(index, {
                        montoStr: raw,
                        monto: parseMontoInput(raw),
                      });
                    }}
                    className={`${inputClass} ${montoMissing ? "border-red-400" : ""}`}
                  />
                  <CrudFieldError
                    message={
                      montoMissing ? "Ingresá un monto mayor a 0." : undefined
                    }
                  />
                </label>
                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-end pb-0.5">
                  <span
                    className={`text-xs tabular-nums ${
                      efecto >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {efecto >= 0 ? "+" : "−"} {fmtMoney(Math.abs(efecto))}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-[10px] uppercase tracking-wider text-vialto-steel hover:text-vialto-fire"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lineas.length > 0 && (
        <div className="flex justify-between border-t border-black/10 pt-2 text-xs">
          <span className="uppercase tracking-[0.12em] text-vialto-steel">
            Efecto neto
          </span>
          <span
            className={`tabular-nums font-medium ${
              efectoNeto >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {efectoNeto >= 0 ? "+" : "−"} {fmtMoney(Math.abs(efectoNeto))}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Payload para create/update de liquidación.
 * Solo incluye filas completas. Antes de llamar, usá
 * `validateConceptosLineasDraft` para no ignorar filas vacías en silencio.
 */
export function toConceptosLineasPayload(lineas: ConceptoLineaDraft[]) {
  return lineas.filter(isConceptoLineaCompleta).map((l) => ({
    conceptoLiquidacionId: l.conceptoLiquidacionId,
    monto: Number(l.monto),
    viajeId: l.viajeId || null,
  }));
}
