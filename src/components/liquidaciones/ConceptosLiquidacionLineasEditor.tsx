import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { CrudFieldLabel } from "@/components/crud/CrudFields";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  ALICUOTAS_IVA_AFIP,
  ALICUOTAS_IVA_AFIP_LABEL,
  esAlicuotaIvaAfip,
  signedMontoConIvaConcepto,
} from "@/lib/liquidacionConceptosIva";
import { tooltipPanelClass } from "@/lib/tooltip";
import type {
  ConceptoLiquidacion,
  ConceptoLiquidacionSigno,
} from "@/types/api";

export type ConceptoLineaDraft = {
  conceptoLiquidacionId: string;
  /**
   * Monto que se envía al backend: monto unitario × cantidad, salvo en
   * TODOS_LOS_VIAJES, donde es el unitario (el backend lo multiplica por los viajes).
   */
  monto: number;
  /**
   * Texto crudo del input de monto unitario. Vacío al agregar una fila para no
   * mostrar "0" (si no, al tipear queda "0100"). Si falta, se deriva del unitario.
   */
  montoStr?: string;
  /** Monto unitario. Si falta (líneas ya guardadas), se toma `monto`. */
  montoUnitario?: number;
  /** Cantidad (default 1). En TODOS_LOS_VIAJES es la cantidad de viajes. */
  cantidad?: number;
  /** Texto crudo del input de cantidad. */
  cantidadStr?: string;
  nombre?: string;
  signo?: ConceptoLiquidacionSigno;
  /** IVA (%) de la línea: arranca con el del catálogo y se puede cambiar. */
  ivaPct?: number;
  /** Texto crudo del input de IVA. */
  ivaPctStr?: string;
  /**
   * Modo de aplicación del concepto: GENERAL, VIAJE_PUNTUAL, TODOS_LOS_VIAJES
   */
  modoAplicacion?: string;
  /**
   * ID del viaje al que corresponde este concepto (si modoAplicacion === 'VIAJE_PUNTUAL').
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

function montoStrFromNumber(monto: number): string {
  return Number.isFinite(monto) && monto > 0 ? String(monto) : "";
}

function parseMontoInput(raw: string): number {
  if (raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const esTodosLosViajes = (modo?: string) => modo === "TODOS_LOS_VIAJES";

function unitarioDe(l: ConceptoLineaDraft): number {
  return l.montoUnitario ?? (Number(l.monto) || 0);
}

function cantidadDe(l: ConceptoLineaDraft): number {
  return l.cantidad ?? 1;
}

/** Monto a enviar según unitario, cantidad y modo (ver `ConceptoLineaDraft.monto`). */
function calcularMontoLinea(l: ConceptoLineaDraft): number {
  const unitario = unitarioDe(l);
  if (esTodosLosViajes(l.modoAplicacion)) return unitario;
  return Math.round(unitario * cantidadDe(l) * 100) / 100;
}

/**
 * Valores por defecto de una línea según el catálogo: monto unitario y cantidad.
 * Con "cantidad = viajes" la línea va como TODOS_LOS_VIAJES (el unitario se
 * multiplica por la cantidad de viajes de la liquidación, acá y en el backend).
 */
function defaultsDesdeCatalogo(
  c: ConceptoLiquidacion,
): Pick<ConceptoLineaDraft, "montoUnitario" | "cantidad" | "modoAplicacion"> {
  return {
    montoUnitario: c.monto ?? 0,
    cantidad: c.cantidad ?? 1,
    modoAplicacion: c.cantidadIgualViajes ? "TODOS_LOS_VIAJES" : "GENERAL",
  };
}

function displayMontoStr(linea: ConceptoLineaDraft): string {
  return linea.montoStr ?? montoStrFromNumber(unitarioDe(linea));
}

function displayCantidadStr(linea: ConceptoLineaDraft): string {
  return linea.cantidadStr ?? String(cantidadDe(linea));
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

/** IVA de la línea inválido para AFIP (vacío o fuera de las alícuotas oficiales). */
function ivaLineaInvalido(l: ConceptoLineaDraft): boolean {
  return !esAlicuotaIvaAfip(l.ivaPct);
}

/**
 * Bloquea guardar si hay filas agregadas sin completar (evita ignorarlas en silencio)
 * o con un IVA que AFIP no acepta.
 */
export function validateConceptosLineasDraft(
  lineas: ConceptoLineaDraft[],
): { ok: true } | { ok: false; message: string; indices: number[] } {
  const indices = findIncompleteConceptosLineas(lineas);
  if (indices.length === 0) {
    const ivaInvalidos = lineas
      .map((l, i) => (ivaLineaInvalido(l) ? i : -1))
      .filter((i) => i >= 0);
    if (ivaInvalidos.length === 0) return { ok: true };
    return {
      ok: false,
      indices: ivaInvalidos,
      message: `IVA inválido en ${
        ivaInvalidos.length === 1 ? "un concepto" : `${ivaInvalidos.length} conceptos`
      }. Usá ${ALICUOTAS_IVA_AFIP_LABEL}.`,
    };
  }
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
  mostrarEfectoNeto = true,
  viajesDisponibles = [],
  autoFillBlockedConcepts = false,
}: {
  getToken: () => Promise<string | null>;
  lineas: ConceptoLineaDraft[];
  onChange: (next: ConceptoLineaDraft[]) => void;
  disabled?: boolean;
  /** Índices de filas a marcar tras un intento de guardar con conceptos incompletos. */
  incompleteIndices?: number[];
  /** false = no muestra la fila "Efecto neto" (ej. cuando el resumen ya lo refleja en otro panel). */
  mostrarEfectoNeto?: boolean;
  /** Viajes de la liquidación: su cantidad es la de los conceptos "cantidad = viajes". */
  viajesDisponibles?: ViajeOpcionDraft[];
  /** Si es true, autoinyecta los conceptos bloqueados al cargar el catálogo (solo para creación). */
  autoFillBlockedConcepts?: boolean;
}) {
  const incompleteSet = new Set(incompleteIndices ?? []);
  const [catalogo, setCatalogo] = useState<ConceptoLiquidacion[]>([]);
  const hasAutoFilled = useRef(false);
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

  useEffect(() => {
    if (!autoFillBlockedConcepts || hasAutoFilled.current || catalogo.length === 0) return;
    hasAutoFilled.current = true;

    const bloqueados = catalogo.filter((c) => c.bloqueado);
    if (bloqueados.length === 0) return;

    if (lineas.length === 0) {
      const nuevos = bloqueados.map((c) => {
        const linea: ConceptoLineaDraft = {
          conceptoLiquidacionId: c.id,
          monto: 0,
          ...defaultsDesdeCatalogo(c),
          nombre: c.nombre,
          signo: c.signo,
          ivaPct: c.ivaPct,
          viajeId: null,
        };
        return { ...linea, monto: calcularMontoLinea(linea) };
      });
      onChange(nuevos);
    }
  }, [autoFillBlockedConcepts, catalogo, lineas.length, onChange]);

  function enrichFromCatalog(
    id: string,
    prev?: ConceptoLineaDraft,
  ): ConceptoLineaDraft {
    const c = catalogo.find((x) => x.id === id);
    const base: ConceptoLineaDraft = {
      ...(prev ?? { monto: 0, montoStr: "" }),
      conceptoLiquidacionId: id,
      nombre: c?.nombre,
      signo: c?.signo,
      ivaPct: c?.ivaPct,
      ivaPctStr: undefined,
      // Sin selector "Aplicar a": el modo lo define el concepto del catálogo.
      modoAplicacion: c
        ? c.cantidadIgualViajes
          ? "TODOS_LOS_VIAJES"
          : "GENERAL"
        : prev?.modoAplicacion,
      viajeId: null,
    };
    // Fila sin monto cargado: precargar monto unitario y cantidad del catálogo.
    if (c && !(unitarioDe(base) > 0)) {
      const d = defaultsDesdeCatalogo(c);
      const linea: ConceptoLineaDraft = {
        ...base,
        ...d,
        montoStr: montoStrFromNumber(d.montoUnitario ?? 0),
        cantidadStr: undefined,
        viajeId: null,
      };
      return { ...linea, monto: calcularMontoLinea(linea) };
    }
    return { ...base, monto: calcularMontoLinea(base) };
  }

  function updateRow(index: number, patch: Partial<ConceptoLineaDraft>) {
    const next = lineas.map((l, i) => {
      if (i !== index) return l;
      const merged = { ...l, ...patch };
      if (patch.conceptoLiquidacionId != null) {
        return enrichFromCatalog(patch.conceptoLiquidacionId, merged);
      }
      return { ...merged, monto: calcularMontoLinea(merged) };
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
    onChange([...lineas, enrichFromCatalog(siguiente.id)]);
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
    if (quickIva.trim() === "" || !esAlicuotaIvaAfip(iva)) {
      errs.ivaPct = `Usá ${ALICUOTAS_IVA_AFIP_LABEL}.`;
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

  const getMultiplicador = (modo?: string) =>
    modo === "TODOS_LOS_VIAJES" ? Math.max(1, viajesDisponibles.length) : 1;

  const efectoNeto = lineas.reduce(
    (sum, l) =>
      sum +
      signedMontoConIvaConcepto(l.signo, Number(l.monto) || 0, l.ivaPct) * getMultiplicador(l.modoAplicacion),
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
              <CrudFieldLabel required>Operación</CrudFieldLabel>
              <select
                value={quickSigno}
                onChange={(e) =>
                  setQuickSigno(e.target.value as ConceptoLiquidacionSigno)
                }
                disabled={creating}
                className={inputClass}
              >
                <option value="favor">Sumar</option>
                <option value="contra">Restar</option>
              </select>
            </label>
            <label className="grid gap-1">
              <div className="flex items-center gap-1.5">
                <CrudFieldLabel required>IVA (%)</CrudFieldLabel>
                <div className="group relative -mt-0.5 flex cursor-help items-center text-vialto-steel hover:text-vialto-charcoal">
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] font-bold"
                    aria-hidden="true"
                  >
                    ?
                  </span>
                  <div className={`${tooltipPanelClass} w-48 font-[family-name:var(--font-ui)]`}>
                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/70">
                      Alícuotas válidas AFIP:
                    </p>
                    <ul className="list-inside list-disc text-sm font-sans tracking-tight">
                      <li>0%</li>
                      <li>2,5%</li>
                      <li>5%</li>
                      <li>10,5%</li>
                      <li>21%</li>
                      <li>27%</li>
                    </ul>
                  </div>
                </div>
              </div>
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
          
        </p>
      ) : (
        <div className="space-y-2">
          {lineas.map((linea, index) => {
            // El signo viene del catálogo al elegir el concepto; no inferirlo del
            // monto (con monto 0, +0 y −0 se ven iguales y el UI no se actualiza).
            const aFavor = linea.signo !== "contra";
            const mult = getMultiplicador(linea.modoAplicacion);
            const efecto = signedMontoConIvaConcepto(
              linea.signo,
              Number(linea.monto) || 0,
              linea.ivaPct,
            ) * mult;
            const montoAbs = Math.abs(efecto);
            const rowIncomplete = incompleteSet.has(index);
            const conceptoMissing =
              rowIncomplete && !linea.conceptoLiquidacionId;
            // Concepto "cantidad = viajes" sin tocar: la cantidad sigue a los viajes elegidos.
            const cantidadSigueViajes = esTodosLosViajes(linea.modoAplicacion);
            const conceptoCatalogo = catalogo.find(
              (c) => c.id === linea.conceptoLiquidacionId,
            );
            const cantViajes = viajesDisponibles.length;
            const mostrarHintViajes =
              Boolean(conceptoCatalogo?.cantidadIgualViajes) &&
              cantViajes > 0 &&
              (cantidadSigueViajes || cantidadDe(linea) === cantViajes);
            const cantidadMissing =
              rowIncomplete && !cantidadSigueViajes && !(cantidadDe(linea) > 0);
            const montoMissing =
              rowIncomplete && !cantidadMissing && !(unitarioDe(linea) > 0);
            // El IVA se marca en vivo: no hace falta intentar guardar para ver el error.
            const ivaInvalido = Boolean(linea.conceptoLiquidacionId) && ivaLineaInvalido(linea);
            return (
              <div
                key={`${linea.conceptoLiquidacionId}-${index}`}
                className={`grid grid-cols-1 gap-2 border p-2 sm:grid-cols-[1fr_6.5rem_5rem_7rem_5rem_8rem_auto] sm:items-end ${
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
                        {c.nombre}
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

                <label>
                  <span className={labelClass}>
                    Operación <span className="text-red-500">*</span>
                  </span>
                  <select
                    value={linea.signo ?? "favor"}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, {
                        signo: e.target.value as ConceptoLiquidacionSigno,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="favor">Sumar</option>
                    <option value="contra">Restar</option>
                  </select>
                </label>

                <label>
                  <span className={labelClass}>
                    Cantidad <span className="text-red-500">*</span>
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={cantidadSigueViajes ? String(mult) : displayCantidadStr(linea)}
                      disabled={disabled}
                      title={
                        mostrarHintViajes
                          ? "Igual a la cantidad de viajes de la liquidación"
                          : undefined
                      }
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        // Editarla a mano deja de seguir la cantidad de viajes.
                        updateRow(index, {
                          cantidadStr: raw,
                          cantidad: parseMontoInput(raw),
                          modoAplicacion: "GENERAL",
                          viajeId: null,
                        });
                      }}
                      className={`${inputClass} ${mostrarHintViajes ? "pr-9" : ""} ${cantidadMissing ? "border-red-400" : ""}`}
                    />
                    {mostrarHintViajes && (
                      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] lowercase text-vialto-steel/70">
                        viajes
                      </span>
                    )}
                  </div>
                  <CrudFieldError
                    message={cantidadMissing ? "Mayor a 0." : undefined}
                  />
                </label>

                <label>
                  <span className={labelClass}>
                    Monto unitario <span className="text-red-500">*</span>
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
                        montoUnitario: parseMontoInput(raw),
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

                <label>
                  <span className={labelClass}>
                    IVA (%) <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    inputMode="decimal"
                    list="conceptos-alicuotas-iva"
                    value={linea.ivaPctStr ?? (linea.ivaPct != null ? String(linea.ivaPct) : "")}
                    disabled={disabled}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateRow(index, {
                        ivaPctStr: raw,
                        ivaPct: Math.min(100, parseMontoInput(raw)),
                      });
                    }}
                    title={`Alícuotas válidas AFIP: ${ALICUOTAS_IVA_AFIP_LABEL}`}
                    className={`${inputClass} ${ivaInvalido ? "border-red-400" : ""}`}
                  />
                  <CrudFieldError
                    message={ivaInvalido ? "Alícuota no válida." : undefined}
                  />
                </label>

                <div>
                  <span className={labelClass}>Subtotal</span>
                  <div
                    className={`flex h-9 items-center rounded border border-black/10 bg-vialto-mist/60 px-2 text-sm tabular-nums ${
                      aFavor ? "text-emerald-700" : "text-red-700"
                    }`}
                    title={`${aFavor ? "Suma" : "Resta"}, con IVA`}
                  >
                    {aFavor ? "+" : "−"} {fmtMoney(montoAbs)}
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      aria-label="Quitar concepto"
                      title="Quitar concepto"
                      className="inline-flex h-9 w-9 items-center justify-center text-vialto-steel hover:bg-vialto-mist hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <datalist id="conceptos-alicuotas-iva">
            {ALICUOTAS_IVA_AFIP.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      )}

      {mostrarEfectoNeto && lineas.length > 0 && (
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
    // En TODOS_LOS_VIAJES la cantidad es la de viajes: no se guarda.
    cantidad: esTodosLosViajes(l.modoAplicacion) ? 1 : cantidadDe(l),
    montoUnitario: unitarioDe(l),
    ...(l.ivaPct != null ? { ivaPct: l.ivaPct } : {}),
    ...(l.signo ? { signo: l.signo } : {}),
    modoAplicacion: l.modoAplicacion ?? 'GENERAL',
    viajeId: l.modoAplicacion === 'VIAJE_PUNTUAL' ? (l.viajeId || null) : null,
  }));
}
