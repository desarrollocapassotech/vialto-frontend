import { useMemo } from "react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { CrudFieldLabel } from "@/components/crud/CrudFields";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import type { Viaje } from "@/types/api";
import {
  importeNetoViajeParaFactura,
  ivaMontoDeTramos,
  roundMoney2,
} from "@/lib/facturaTotales";
import { ordenarAlfabetico } from "@/lib/ordenAlfabetico";
import { marcarModalModificado } from "@/lib/descarteModal";
import {
  formatCurrencyArFromNumber,
  maskCurrencyArInput,
  parseCurrencyAr,
} from "@/lib/currencyMask";

export type FacturaTramoDraft = {
  viajeId: string;
  detalle: string;
  monto: number;
  /** Texto crudo del input de monto (evita mostrar "0" al agregar). */
  montoStr?: string;
  ivaPct: number;
  ivaPctStr?: string;
};

const inputClass =
  "h-9 w-full rounded border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35";

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseNumberInput(raw: string): number {
  if (raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function displayMontoStr(t: FacturaTramoDraft): string {
  return t.montoStr ?? (t.monto > 0 ? formatCurrencyArFromNumber(t.monto) : "");
}

function displayIvaPctStr(t: FacturaTramoDraft): string {
  return t.ivaPctStr ?? String(t.ivaPct);
}

export function emptyFacturaTramoDraft(
  ivaPctDefault = 21,
  viajeId = "",
): FacturaTramoDraft {
  return {
    viajeId,
    detalle: "",
    monto: 0,
    montoStr: "",
    ivaPct: ivaPctDefault,
    ivaPctStr: String(ivaPctDefault),
  };
}

export function isFacturaTramoCompleto(t: FacturaTramoDraft): boolean {
  return (
    Boolean(t.viajeId) &&
    Boolean(t.detalle.trim()) &&
    Number(t.monto) > 0 &&
    Number.isFinite(t.ivaPct) &&
    t.ivaPct >= 0
  );
}

export function validateFacturaTramosDraft(
  tramos: FacturaTramoDraft[],
  viajeIds: string[],
): { ok: true } | { ok: false; message: string; indices: number[] } {
  if (tramos.length === 0) {
    return {
      ok: false,
      message: "Para facturar por tramo tenés que cargar al menos un tramo.",
      indices: [],
    };
  }
  const allowed = new Set(viajeIds);
  const indices: number[] = [];
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i];
    if (!isFacturaTramoCompleto(t) || !allowed.has(t.viajeId)) {
      indices.push(i);
    }
  }
  if (indices.length === 0) return { ok: true };
  return {
    ok: false,
    indices,
    message:
      indices.length === 1
        ? "Hay un tramo incompleto. Completá viaje, descripción, importe e IVA o quitalo."
        : `Hay ${indices.length} tramos incompletos. Completá viaje, descripción, importe e IVA o quitalos.`,
  };
}

export function toFacturaTramosPayload(tramos: FacturaTramoDraft[]) {
  return tramos.filter(isFacturaTramoCompleto).map((t, orden) => ({
    viajeId: t.viajeId,
    detalle: t.detalle.trim(),
    monto: t.monto,
    ivaPct: t.ivaPct,
    orden,
  }));
}

/**
 * Neto = suma de los tramos cargados (para viajes con tramo) + viajes sin tramo.
 * La suma de los tramos pisa el monto del viaje.
 * IVA = tramos cargados + viajes sin tramo con IVA de cabecera.
 */
export function computeTotalesFacturaPorTramo(
  viajeIds: string[],
  viajes: Viaje[],
  tramos: FacturaTramoDraft[],
  ivaPctViajesSinTramo: number,
): { neto: number; iva: number; total: number } {
  const completos = tramos.filter(isFacturaTramoCompleto);
  const viajesVinculados = viajes.filter((x) => viajeIds.includes(x.id));
  const viajeIdsConTramo = new Set(
    completos.map((t) => t.viajeId).filter(Boolean),
  );
  const sumaTramos = roundMoney2(
    completos.reduce((s, t) => s + (t.monto ?? 0), 0),
  );
  const sumaViajesSinTramo = roundMoney2(
    viajesVinculados
      .filter((v) => !viajeIdsConTramo.has(v.id))
      .reduce((s, v) => s + importeNetoViajeParaFactura(v), 0),
  );
  const neto = roundMoney2(
    completos.length > 0
      ? sumaTramos + sumaViajesSinTramo
      : viajesVinculados.reduce((s, v) => s + importeNetoViajeParaFactura(v), 0),
  );
  const iva = ivaMontoDeTramos(
    neto,
    completos,
    ivaPctViajesSinTramo,
    viajesVinculados,
  );
  return { neto, iva, total: roundMoney2(neto + iva) };
}

interface Props {
  tramos: FacturaTramoDraft[];
  onChange: (next: FacturaTramoDraft[]) => void;
  viajeIds: string[];
  viajes: Viaje[];
  ivaPctDefault: number;
  disabled?: boolean;
  incompleteIndices?: number[];
}

export function FacturaTramosEditor({
  tramos,
  onChange,
  viajeIds,
  viajes,
  ivaPctDefault,
  disabled,
  incompleteIndices = [],
}: Props) {
  const vinculados = useMemo(
    () => viajes.filter((v) => viajeIds.includes(v.id)),
    [viajes, viajeIds],
  );

  function updateTramo(index: number, patch: Partial<FacturaTramoDraft>) {
    onChange(tramos.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTramo() {
    if (viajeIds.length === 0) return;
    const defaultViajeId =
      vinculados.length === 1 ? vinculados[0].id : viajeIds[0] ?? "";
    // Agregar/quitar es solo un click (sin input/change): avisar al modal que hubo cambios.
    marcarModalModificado();
    onChange([...tramos, emptyFacturaTramoDraft(ivaPctDefault, defaultViajeId)]);
  }

  function removeTramo(index: number) {
    marcarModalModificado();
    onChange(tramos.filter((_, i) => i !== index));
  }

  // Un tramo nuevo recién cuando los anteriores están completos (no se acumulan filas vacías).
  const hayTramoIncompleto = tramos.some((t) => !isFacturaTramoCompleto(t));

  const viajesConDiferencia = useMemo(() => {
    const tramosPorViaje = new Map<string, number>();
    for (const t of tramos) {
      if (isFacturaTramoCompleto(t) && t.viajeId) {
        tramosPorViaje.set(
          t.viajeId,
          roundMoney2((tramosPorViaje.get(t.viajeId) ?? 0) + t.monto),
        );
      }
    }
    const lista: Array<{ viaje: Viaje; sumaTramos: number; montoOriginal: number }> = [];
    for (const v of vinculados) {
      if (!tramosPorViaje.has(v.id)) continue;
      const suma = tramosPorViaje.get(v.id) ?? 0;
      const original = importeNetoViajeParaFactura(v);
      if (Math.abs(suma - original) > 0.005) {
        lista.push({ viaje: v, sumaTramos: suma, montoOriginal: original });
      }
    }
    return lista;
  }, [vinculados, tramos]);

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-vialto-steel">
        Tramos
      </p>

      {viajeIds.length === 0 && (
        <p className="text-xs text-vialto-steel border border-black/10 bg-vialto-mist/40 px-3 py-2">
          Vinculá al menos un viaje para poder cargar tramos.
        </p>
      )}

      {viajeIds.length > 0 && tramos.length === 0 && (
        <p className="text-xs text-vialto-steel border border-black/10 bg-vialto-mist/40 px-3 py-2">
          Sin tramos. Agregá al menos uno con viaje, descripción, importe e IVA.
        </p>
      )}

      {tramos.map((tramo, index) => {
        const incomplete = incompleteIndices.includes(index);
        const base = roundMoney2(tramo.monto);
        const subtotal = roundMoney2(base + roundMoney2((base * tramo.ivaPct) / 100));
        return (
          <div
            key={index}
            className={[
              "grid gap-2 sm:grid-cols-[1fr_1fr_130px_80px_130px_auto] items-end border p-3",
              incomplete
                ? "border-red-300 bg-red-50/40"
                : "border-black/10 bg-vialto-mist/30",
            ].join(" ")}
          >
            <div>
              <CrudFieldLabel required>Viaje</CrudFieldLabel>
              <select
                value={tramo.viajeId}
                disabled={disabled}
                onChange={(e) => updateTramo(index, { viajeId: e.target.value })}
                className={[
                  inputClass,
                  incomplete && !tramo.viajeId ? "border-red-400" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label="Viaje del tramo"
              >
                <option value="">— Elegí un viaje —</option>
                {ordenarAlfabetico(vinculados, (v) => numeroVisibleViaje(v)).map((v) => (
                  <option key={v.id} value={v.id}>
                    {/* Con ID propio alcanza con el ID; con el de sistema se suma la ruta. */}
                    #{numeroVisibleViaje(v)}
                    {!v.numeroIdentificacionPersonalizado?.trim() && v.origen && v.destino
                      ? ` · ${v.origen} — ${v.destino}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <CrudFieldLabel required>Descripción</CrudFieldLabel>
              <input
                type="text"
                value={tramo.detalle}
                disabled={disabled}
                onChange={(e) => updateTramo(index, { detalle: e.target.value })}
                className={[
                  inputClass,
                  incomplete && !tramo.detalle.trim() ? "border-red-400" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                placeholder="Ej. Tramo Argentina"
              />
            </div>
            <div>
              <CrudFieldLabel required>Importe</CrudFieldLabel>
              <input
                type="text"
                inputMode="decimal"
                disabled={disabled}
                value={displayMontoStr(tramo)}
                onChange={(e) => {
                  // Miles con "." y decimales con ",".
                  const montoStr = maskCurrencyArInput(e.target.value);
                  updateTramo(index, {
                    montoStr,
                    monto: parseCurrencyAr(montoStr) ?? 0,
                  });
                }}
                placeholder="0,00"
                className={[
                  inputClass,
                  incomplete && !(tramo.monto > 0) ? "border-red-400" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </div>
            <div>
              <CrudFieldLabel required>IVA %</CrudFieldLabel>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                disabled={disabled}
                value={displayIvaPctStr(tramo)}
                onChange={(e) => {
                  const ivaPctStr = e.target.value;
                  updateTramo(index, {
                    ivaPctStr,
                    ivaPct: parseNumberInput(ivaPctStr),
                  });
                }}
                className={inputClass}
              />
            </div>
            <div>
              <CrudFieldLabel>Subtotal</CrudFieldLabel>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={fmtMoney(subtotal)}
                className={`${inputClass} bg-vialto-mist tabular-nums text-right`}
                aria-label="Subtotal del tramo (importe + IVA)"
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeTramo(index)}
              className="h-9 px-2 text-xs uppercase tracking-wider text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
              aria-label="Quitar tramo"
            >
              Quitar
            </button>
            {incomplete && (
              <div className="sm:col-span-6">
                <CrudFieldError message="Completá viaje, descripción, importe e IVA." />
              </div>
            )}
          </div>
        );
      })}

      {viajeIds.length > 0 && (
        <button
          type="button"
          disabled={disabled || hayTramoIncompleto}
          onClick={addTramo}
          title={
            hayTramoIncompleto
              ? "Completá viaje, descripción, importe e IVA del tramo anterior para agregar otro."
              : undefined
          }
          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Agregar tramo
        </button>
      )}

      {viajesConDiferencia.length > 0 && (
        <div className="rounded border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-900 leading-relaxed">
          <span className="font-medium">Importante:</span>{" "}
          {viajesConDiferencia.length === 1 ? (
            <>
              La suma de los tramos cargados ({fmtMoney(viajesConDiferencia[0].sumaTramos)}) difiere del monto del viaje ({fmtMoney(viajesConDiferencia[0].montoOriginal)}). Al guardar, el monto del viaje se actualizará a la nueva sumatoria.
            </>
          ) : (
            <>
              La suma de los tramos cargados difiere del monto original de los viajes. Al guardar, el monto de cada viaje se actualizará a la sumatoria de sus tramos.
            </>
          )}
        </div>
      )}
    </div>
  );
}
