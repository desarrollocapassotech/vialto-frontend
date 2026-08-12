import { useMemo } from "react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { CrudFieldLabel } from "@/components/crud/CrudFields";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import type { Viaje } from "@/types/api";

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
  return t.montoStr ?? (t.monto > 0 ? String(t.monto) : "");
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
        ? "Hay un tramo incompleto. Completá viaje, país/detalle, monto e IVA o quitalo."
        : `Hay ${indices.length} tramos incompletos. Completá viaje, país/detalle, monto e IVA o quitalos.`,
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

/** Neto / IVA / total: tramos con su IVA propio + viajes sin ningún tramo con IVA de cabecera. */
export function computeTotalesFacturaPorTramo(
  viajeIds: string[],
  viajes: Viaje[],
  tramos: FacturaTramoDraft[],
  ivaPctViajesSinTramo: number,
): { neto: number; iva: number; total: number } {
  const completos = tramos.filter(isFacturaTramoCompleto);
  const viajeIdsConTramo = new Set(completos.map((t) => t.viajeId));

  let neto = 0;
  let iva = 0;

  for (const t of completos) {
    neto += t.monto;
    iva += (t.monto * t.ivaPct) / 100;
  }

  for (const id of viajeIds) {
    if (viajeIdsConTramo.has(id)) continue;
    const v = viajes.find((x) => x.id === id);
    const monto = v?.monto ?? 0;
    neto += monto;
    iva += (monto * ivaPctViajesSinTramo) / 100;
  }

  return { neto, iva, total: neto + iva };
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
    onChange([...tramos, emptyFacturaTramoDraft(ivaPctDefault, defaultViajeId)]);
  }

  function removeTramo(index: number) {
    onChange(tramos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-vialto-steel">
          Tramos
        </p>
        <button
          type="button"
          disabled={disabled || viajeIds.length === 0}
          onClick={addTramo}
          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
        >
          + Agregar tramo
        </button>
      </div>

      {viajeIds.length === 0 && (
        <p className="text-xs text-vialto-steel border border-black/10 bg-vialto-mist/40 px-3 py-2">
          Vinculá al menos un viaje para poder cargar tramos.
        </p>
      )}

      {viajeIds.length > 0 && tramos.length === 0 && (
        <p className="text-xs text-vialto-steel border border-black/10 bg-vialto-mist/40 px-3 py-2">
          Sin tramos. Agregá al menos uno con viaje, país/detalle, monto e IVA.
        </p>
      )}

      {tramos.map((tramo, index) => {
        const incomplete = incompleteIndices.includes(index);
        const ivaMonto = (tramo.monto * tramo.ivaPct) / 100;
        const totalTramo = tramo.monto + ivaMonto;
        return (
          <div
            key={index}
            className={[
              "grid gap-2 sm:grid-cols-[1fr_1fr_110px_80px_auto] items-end border p-3",
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
                {vinculados.map((v) => (
                  <option key={v.id} value={v.id}>
                    #{numeroVisibleViaje(v)}
                    {v.origen && v.destino
                      ? ` · ${v.origen} — ${v.destino}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <CrudFieldLabel required>País / detalle</CrudFieldLabel>
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
              <CrudFieldLabel required>Monto</CrudFieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={disabled}
                value={displayMontoStr(tramo)}
                onChange={(e) => {
                  const montoStr = e.target.value;
                  updateTramo(index, {
                    montoStr,
                    monto: parseNumberInput(montoStr),
                  });
                }}
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
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeTramo(index)}
              className="h-9 px-2 text-xs uppercase tracking-wider text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
              aria-label="Quitar tramo"
            >
              Quitar
            </button>
            <div className="sm:col-span-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-vialto-steel">
              <span>
                IVA:{" "}
                <span className="tabular-nums text-vialto-charcoal">
                  {fmtMoney(ivaMonto)}
                </span>
              </span>
              <span>
                Total tramo:{" "}
                <span className="tabular-nums font-medium text-vialto-charcoal">
                  {fmtMoney(totalTramo)}
                </span>
              </span>
            </div>
            {incomplete && (
              <div className="sm:col-span-5">
                <CrudFieldError message="Completá viaje, país/detalle, monto e IVA." />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
