import { useMemo, useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";

export type ViajeSeleccionable = {
  id: string;
  numero: string;
  fechaCarga: string | null;
  origen: string | null;
  destino: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Tabla de viajes con checkbox de selección, buscador y filtro de fecha.
 * Usada en los modales de "nueva factura" y "nueva liquidación" para elegir viajes.
 */
export function ViajesSeleccionTabla<T extends ViajeSeleccionable>({
  viajes,
  selectedIds,
  onToggle,
  renderMonto,
  disabledCheck,
  loading,
  maxHeightClass = "max-h-72",
  emptyMessage = "No hay viajes disponibles.",
}: {
  viajes: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  renderMonto: (v: T) => ReactNode;
  /** Permite deshabilitar la selección de un viaje puntual (p. ej. moneda incompatible con la selección actual). */
  disabledCheck?: (v: T) => { disabled: boolean; title?: string };
  loading?: boolean;
  maxHeightClass?: string;
  emptyMessage?: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return viajes.filter((v) => {
      if (q) {
        const numero = String(v.numero ?? "").toLowerCase();
        const origen = (v.origen ?? "").toLowerCase();
        const destino = (v.destino ?? "").toLowerCase();
        if (!numero.includes(q) && !origen.includes(q) && !destino.includes(q))
          return false;
      }
      const fecha = v.fechaCarga ? v.fechaCarga.slice(0, 10) : "";
      if (fechaDesde && (!fecha || fecha < fechaDesde)) return false;
      if (fechaHasta && (!fecha || fecha > fechaHasta)) return false;
      return true;
    });
  }, [viajes, busqueda, fechaDesde, fechaHasta]);

  const hayFiltrosActivos = !!busqueda.trim() || !!fechaDesde || !!fechaHasta;

  function handleRowClick(v: T, disabled: boolean, selected: boolean) {
    if (disabled && !selected) return;
    onToggle(v.id);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
          Buscar
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Número, origen o destino…"
            className="h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
          Desde
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="h-9 border border-black/15 bg-white px-2 text-sm text-vialto-charcoal"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
          Hasta
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="h-9 border border-black/15 bg-white px-2 text-sm text-vialto-charcoal"
          />
        </label>
        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setFechaDesde("");
              setFechaHasta("");
            }}
            className="h-9 shrink-0 border border-black/15 bg-white px-3 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
          >
            Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-vialto-steel">
          <Spinner /> Cargando viajes…
        </div>
      ) : viajes.length === 0 ? (
        <p className="py-2 text-xs text-vialto-steel">{emptyMessage}</p>
      ) : filtrados.length === 0 ? (
        <p className="py-2 text-xs text-vialto-steel">
          Ningún viaje coincide con el filtro.
        </p>
      ) : (
        <div
          className={`${maxHeightClass} overflow-auto rounded border border-black/15`}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-vialto-mist text-[10px] uppercase tracking-wider text-vialto-steel">
              <tr>
                <th className="w-8 px-2 py-2 text-left" />
                <th className="px-2 py-2 text-left">Número</th>
                <th className="px-2 py-2 text-left">Fecha</th>
                <th className="px-2 py-2 text-left">Origen → Destino</th>
                <th className="px-2 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 bg-white">
              {filtrados.map((v) => {
                const selected = selectedIds.includes(v.id);
                const check = disabledCheck?.(v) ?? { disabled: false };
                const disabled = check.disabled && !selected;
                return (
                  <tr
                    key={v.id}
                    title={check.title}
                    onClick={() => handleRowClick(v, check.disabled, selected)}
                    className={
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:bg-vialto-mist/40"
                    }
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="accent-vialto-charcoal"
                        checked={selected}
                        disabled={disabled}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => onToggle(v.id)}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-vialto-charcoal">
                      {v.numero}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-vialto-steel">
                      {fmtDate(v.fechaCarga)}
                    </td>
                    <td className="px-2 py-1.5 text-vialto-steel">
                      {v.origen ?? "—"} → {v.destino ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-vialto-steel">
                      {renderMonto(v)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
