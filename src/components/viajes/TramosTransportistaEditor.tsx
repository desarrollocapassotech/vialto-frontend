import { CrudFieldLabel } from "@/components/crud/CrudFields";
import { marcarModalModificado } from "@/lib/descarteModal";
import {
  formatCurrencyArFromNumber,
  maskCurrencyArInput,
  parseCurrencyAr,
} from "@/lib/currencyMask";
import {
  tramoTransportistaCompleto,
  type TramoTransportistaDraft,
} from "@/lib/viajeTramosTransportista";

/**
 * Tramos del pago al transportista, cada uno con su % de IVA (pedido LSF: el
 * transportista uruguayo cobra IVA solo sobre el tramo hecho en Uruguay). Mismo
 * formato que "Facturar por tramo" (`FacturaTramosEditor`), sin elegir viaje.
 * Lo que no cubren los tramos usa el % de IVA general del viaje.
 */

const inputClass =
  "h-9 w-full rounded border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 disabled:bg-vialto-mist disabled:text-vialto-steel";

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function TramosTransportistaEditor({
  tramos,
  onChange,
  disabled,
  marcarIncompletos,
  ivaPctDefault = 22,
}: {
  tramos: TramoTransportistaDraft[];
  onChange: (tramos: TramoTransportistaDraft[]) => void;
  disabled?: boolean;
  /** Marca en rojo los tramos a medio cargar (tras un intento de guardar). */
  marcarIncompletos?: boolean;
  /** % con el que arranca un tramo nuevo. */
  ivaPctDefault?: number;
}) {
  function update(index: number, patch: Partial<TramoTransportistaDraft>) {
    onChange(tramos.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function agregar() {
    // Agregar/quitar es solo un click (sin input/change): avisar al modal que hubo cambios.
    marcarModalModificado();
    onChange([
      ...tramos,
      {
        detalle: "",
        monto: 0,
        montoStr: "",
        ivaPct: ivaPctDefault,
        ivaPctStr: String(ivaPctDefault),
      },
    ]);
  }

  function quitar(index: number) {
    marcarModalModificado();
    onChange(tramos.filter((_, i) => i !== index));
  }

  const hayIncompleto = tramos.some((t) => !tramoTransportistaCompleto(t));

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-vialto-steel">Tramos de IVA</p>
      {tramos.length === 0 && (
        <p className="text-xs text-vialto-steel">
          Sin tramos: el % de IVA se aplica a todo el precio. Agregá tramos si el
          transportista cobra IVA solo sobre una parte del recorrido.
        </p>
      )}
      {tramos.map((tramo, index) => {
        const incompleto = marcarIncompletos && !tramoTransportistaCompleto(tramo);
        const base = round2(tramo.monto);
        const iva = round2((base * (tramo.ivaPct || 0)) / 100);
        return (
          <div
            key={index}
            className={[
              "grid items-end gap-2 border p-3 sm:grid-cols-[1fr_130px_80px_130px_auto]",
              incompleto ? "border-red-300 bg-red-50/40" : "border-black/10 bg-vialto-mist/30",
            ].join(" ")}
          >
            <div>
              <CrudFieldLabel required>Descripción</CrudFieldLabel>
              <input
                type="text"
                value={tramo.detalle}
                disabled={disabled}
                onChange={(e) => update(index, { detalle: e.target.value })}
                className={`${inputClass} ${incompleto && !tramo.detalle.trim() ? "border-red-400" : ""}`}
                placeholder="Ej. Tramo Uruguay"
              />
            </div>
            <div>
              <CrudFieldLabel required>Monto</CrudFieldLabel>
              <input
                type="text"
                inputMode="decimal"
                disabled={disabled}
                value={
                  tramo.montoStr ??
                  (tramo.monto > 0 ? formatCurrencyArFromNumber(tramo.monto) : "")
                }
                onChange={(e) => {
                  const montoStr = maskCurrencyArInput(e.target.value);
                  update(index, { montoStr, monto: parseCurrencyAr(montoStr) ?? 0 });
                }}
                placeholder="0,00"
                className={`${inputClass} ${incompleto && !(tramo.monto > 0) ? "border-red-400" : ""}`}
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
                value={tramo.ivaPctStr ?? String(tramo.ivaPct)}
                onChange={(e) => {
                  const ivaPctStr = e.target.value;
                  const n = ivaPctStr.trim() === "" ? NaN : Number(ivaPctStr);
                  update(index, { ivaPctStr, ivaPct: Number.isFinite(n) ? n : NaN });
                }}
                className={`${inputClass} ${incompleto && !(tramo.ivaPct >= 0 && tramo.ivaPct <= 100) ? "border-red-400" : ""}`}
              />
            </div>
            <div>
              <CrudFieldLabel>IVA del tramo</CrudFieldLabel>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={fmtMoney(iva)}
                className={`${inputClass} bg-vialto-mist text-right tabular-nums`}
                aria-label="IVA del tramo"
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => quitar(index)}
              className="h-9 border border-red-200 px-2 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-50"
              aria-label="Quitar tramo"
            >
              Quitar
            </button>
          </div>
        );
      })}
      {!disabled && (
        <button
          type="button"
          disabled={hayIncompleto}
          onClick={agregar}
          title={
            hayIncompleto
              ? "Completá descripción, monto e IVA del tramo anterior para agregar otro."
              : undefined
          }
          className="border border-black/20 px-2 py-1 text-xs uppercase tracking-wider hover:bg-vialto-mist disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Agregar tramo
        </button>
      )}
    </div>
  );
}
