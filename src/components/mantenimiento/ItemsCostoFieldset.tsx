import { Plus, Trash2 } from "lucide-react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { maskCurrencyArInput } from "@/lib/currencyMask";
import { nuevaLineaCosto, totalLineas, type LineaCosto } from "@/lib/mantenimientoCostos";
import { fmtMoneda } from "@/lib/mantenimientoLabels";

const INPUT = "h-10 w-full border bg-white px-3 text-sm";

/**
 * Líneas de costo de una OT (repuestos, mano de obra, etc.): filas libres, el total se calcula.
 * Se mandan al backend como `{ descripcion, costoUnitario }` (cantidad 1); el backend recalcula.
 */
export function ItemsCostoFieldset({
  lineas,
  onChange,
  errores,
}: {
  lineas: LineaCosto[];
  onChange: (next: LineaCosto[]) => void;
  /** Errores por línea: `{ [key]: { descripcion?, importe? } }`. */
  errores: Record<string, { descripcion?: string; importe?: string }>;
}) {
  function actualizar(key: string, cambio: Partial<LineaCosto>) {
    onChange(lineas.map((l) => (l.key === key ? { ...l, ...cambio } : l)));
  }

  return (
    <div className="grid gap-2">
      {lineas.length === 0 && (
        <p className="text-sm text-vialto-steel">Sin costos cargados (la orden queda con total $ 0).</p>
      )}
      {lineas.map((l) => (
        <div key={l.key} className="grid grid-cols-[1fr_9rem_auto] items-start gap-2">
          <div className="grid gap-1">
            <input
              type="text"
              value={l.descripcion}
              onChange={(e) => actualizar(l.key, { descripcion: e.target.value })}
              placeholder="Ej. Aceite 15W40 x 40 L"
              aria-label="Descripción del costo"
              className={`${INPUT} ${errores[l.key]?.descripcion ? "border-red-400" : "border-black/15"}`}
            />
            <CrudFieldError message={errores[l.key]?.descripcion} />
          </div>
          <div className="grid gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={l.importe}
              onChange={(e) => actualizar(l.key, { importe: maskCurrencyArInput(e.target.value) })}
              placeholder="$ 0"
              aria-label="Importe"
              className={`${INPUT} text-right tabular-nums ${errores[l.key]?.importe ? "border-red-400" : "border-black/15"}`}
            />
            <CrudFieldError message={errores[l.key]?.importe} />
          </div>
          <button
            type="button"
            onClick={() => onChange(lineas.filter((x) => x.key !== l.key))}
            aria-label="Quitar línea"
            className="inline-flex h-10 w-10 items-center justify-center text-vialto-steel hover:bg-vialto-mist hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => onChange([...lineas, nuevaLineaCosto()])}
          className="inline-flex h-9 items-center gap-1.5 border border-black/20 px-3 text-xs uppercase tracking-wider hover:bg-vialto-mist"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Agregar costo
        </button>
        <p className="text-sm">
          <span className="text-vialto-steel">Total: </span>
          <span className="font-semibold tabular-nums">{fmtMoneda(totalLineas(lineas))}</span>
        </p>
      </div>
    </div>
  );
}
