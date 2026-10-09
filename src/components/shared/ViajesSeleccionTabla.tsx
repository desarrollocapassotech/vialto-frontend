import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Filter, Search, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import { useFieldConfig } from "@/hooks/useFieldConfig";

export type ViajeSeleccionable = {
  id: string;
  numero: string;
  numeroIdentificacionPersonalizado?: string | null;
  idPropio2?: string | null;
  fechaCarga: string | null;
  origen: string | null;
  destino: string | null;
  choferId?: string | null;
  chofer?: { nombre: string } | null;
  productosViaje?: Array<{ producto: { nombre: string } }>;
  transportista?: { nombre: string } | null;
  cliente?: { nombre: string } | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function nombreChoferSeleccion(v: ViajeSeleccionable): string {
  return v.chofer?.nombre?.trim() || "—";
}

function nombresProductosSeleccion(v: ViajeSeleccionable): string {
  const nombres = (v.productosViaje ?? [])
    .map((p) => p.producto?.nombre?.trim())
    .filter((n): n is string => Boolean(n));
  return nombres.length ? nombres.join(", ") : "—";
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
  montoSinIva,
  disabledCheck,
  loading,
  maxHeightClass = "max-h-72",
  fillHeight = false,
  emptyMessage = "No hay viajes disponibles.",
  idSistemaHabilitado = true,
  idPropio1Habilitado = true,
  idPropio1Label = "ID personalizado",
  idPropio2Habilitado = false,
  idPropio2Label = "ID Propio 2",
  mostrarCliente = false,
  mostrarTransporte = true,
  monedaDe,
}: {
  viajes: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** `conMoneda` = false cuando la moneda ya está en el encabezado (ver `monedaDe`). */
  renderMonto: (v: T, conMoneda: boolean) => ReactNode;
  /** Permite deshabilitar la selección de un viaje puntual (p. ej. moneda incompatible con la selección actual). */
  disabledCheck?: (v: T) => { disabled: boolean; title?: string };
  loading?: boolean;
  maxHeightClass?: string;
  /** Ocupa el alto disponible del contenedor padre (flex) en lugar de un max-height fijo. */
  fillHeight?: boolean;
  emptyMessage?: string;
  /** true = el tenant muestra la columna dedicada "ID Sistema" (default true). */
  idSistemaHabilitado?: boolean;
  /** true = el tenant muestra la columna dedicada "ID Propio 1" (default true). */
  idPropio1Habilitado?: boolean;
  /** Label configurable de la columna "ID Propio 1". */
  idPropio1Label?: string;
  /** true = el tenant habilitó "ID Propio 2" — muestra una columna adicional. */
  idPropio2Habilitado?: boolean;
  /** Label configurable de la columna "ID Propio 2". */
  idPropio2Label?: string;
  /**
   * Muestra la columna "Cliente" (y la incluye en el buscador). Off por defecto: en factura
   * los viajes ya vienen filtrados por cliente; en liquidación (por transportista) sí suma.
   */
  mostrarCliente?: boolean;
  /** false = oculta la columna "Transporte" (ej. liquidación: todos son del mismo transportista). */
  mostrarTransporte?: boolean;
  /**
   * Moneda del monto de cada viaje. Si todos los viajes comparten la misma, va en el
   * encabezado ("Monto (ARS)") y `renderMonto` recibe `conMoneda: false` (solo "$").
   */
  monedaDe?: (v: T) => string;
  /** true = el monto es sin IVA: el encabezado dice "Monto (s/IVA)", sin la moneda. */
  montoSinIva?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const { isVisible } = useFieldConfig("viajes");
  const mostrarChofer =
    isVisible("detalle_viaje", "choferId") ||
    isVisible("detalle_viaje", "choferExternoId");
  const mostrarProducto = isVisible("detalle_viaje", "productoItems");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return viajes.filter((v) => {
      if (q) {
        const numero = numeroVisibleViaje(v).toLowerCase();
        const origen = (v.origen ?? "").toLowerCase();
        const destino = (v.destino ?? "").toLowerCase();
        const chofer = mostrarChofer
          ? nombreChoferSeleccion(v).toLowerCase()
          : "";
        const productos = mostrarProducto
          ? nombresProductosSeleccion(v).toLowerCase()
          : "";
        const transporte = mostrarTransporte
          ? (v.transportista?.nombre ?? "").toLowerCase()
          : "";
        const cliente = mostrarCliente
          ? (v.cliente?.nombre ?? "").toLowerCase()
          : "";
        if (
          !numero.includes(q) &&
          !origen.includes(q) &&
          !destino.includes(q) &&
          !chofer.includes(q) &&
          !productos.includes(q) &&
          !transporte.includes(q) &&
          !cliente.includes(q)
        )
          return false;
      }
      const fecha = v.fechaCarga ? v.fechaCarga.slice(0, 10) : "";
      if (fechaDesde && (!fecha || fecha < fechaDesde)) return false;
      if (fechaHasta && (!fecha || fecha > fechaHasta)) return false;
      return true;
    });
  }, [viajes, busqueda, fechaDesde, fechaHasta, mostrarChofer, mostrarProducto, mostrarCliente, mostrarTransporte]);

  // Moneda común a todos los viajes de la tabla (no solo los filtrados: el encabezado no
  // cambia al buscar). Con monedas mezcladas, cada monto conserva la suya.
  const monedaUnica = useMemo(() => {
    if (!monedaDe || viajes.length === 0) return null;
    const monedas = new Set(viajes.map(monedaDe));
    return monedas.size === 1 ? [...monedas][0] : null;
  }, [viajes, monedaDe]);

  const hayFiltrosActivos =!!busqueda.trim() || !!fechaDesde || !!fechaHasta;

  function handleRowClick(v: T, disabled: boolean, selected: boolean) {
    if (disabled && !selected) return;
    onToggle(v.id);
  }

  return (
    <div
      className={
        fillHeight
          ? "flex h-full min-h-0 flex-col overflow-hidden rounded border border-black/15"
          : "flex flex-col overflow-hidden rounded border border-black/15"
      }
    >
      {/* Barra de filtros de la tabla: fondo propio + ícono/etiqueta "Filtros", para que no se lea como campos del formulario. */}
      <div
        role="search"
        aria-label="Filtros de viajes"
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-black/10 bg-vialto-mist px-3 py-2"
      >
        <span className="flex items-center gap-1.5 pr-1 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel">
          <Filter
            className={`h-3.5 w-3.5 ${hayFiltrosActivos ? "text-vialto-fire" : ""}`}
            strokeWidth={2}
            aria-hidden
          />
          Filtros
        </span>
        <div className="relative min-w-[10rem] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-vialto-steel"
            aria-hidden
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar viajes"
            className={`h-8 w-full rounded-full border bg-white pl-8 pr-3 text-xs text-vialto-charcoal placeholder:text-vialto-steel/80 focus:outline-none focus:ring-1 focus:ring-vialto-charcoal/30 ${
              busqueda.trim() ? "border-vialto-charcoal/40" : "border-black/10"
            }`}
          />
        </div>
        <div
          className={`flex h-8 items-center gap-1.5 rounded-full border bg-white pl-2.5 pr-1 text-xs ${
            fechaDesde || fechaHasta ? "border-vialto-charcoal/40" : "border-black/10"
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-vialto-steel" aria-hidden />
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            aria-label="Fecha desde"
            className="h-7 bg-transparent text-xs text-vialto-charcoal focus:outline-none"
          />
          <span className="text-vialto-steel" aria-hidden>–</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            aria-label="Fecha hasta"
            className="h-7 bg-transparent text-xs text-vialto-charcoal focus:outline-none"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!loading && viajes.length > 0 && (
            <span className="text-[11px] tabular-nums text-vialto-steel">
              {hayFiltrosActivos
                ? `${filtrados.length} de ${viajes.length}`
                : `${viajes.length} viaje${viajes.length !== 1 ? "s" : ""}`}
            </span>
          )}
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setFechaDesde("");
                setFechaHasta("");
              }}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] uppercase tracking-wider text-vialto-steel hover:bg-white hover:text-vialto-charcoal"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-3 py-3 text-xs text-vialto-steel">
          <Spinner /> Cargando viajes…
        </div>
      ) : viajes.length === 0 ? (
        <p className="px-3 py-3 text-xs text-vialto-steel">{emptyMessage}</p>
      ) : filtrados.length === 0 ? (
        <p className="px-3 py-3 text-xs text-vialto-steel">
          Ningún viaje coincide con el filtro.
        </p>
      ) : (
        <div
          className={
            fillHeight
              ? "h-0 min-h-0 flex-1 overflow-auto"
              : `${maxHeightClass} overflow-auto`
          }
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] text-[10px] uppercase tracking-wider text-vialto-steel">
              <tr>
                <th className="w-8 px-2 py-2 text-left" />
                {idSistemaHabilitado && (
                  <th className="px-2 py-2 text-left">ID sistema</th>
                )}
                {idPropio1Habilitado && (
                  <th className="px-2 py-2 text-left">{idPropio1Label}</th>
                )}
                {idPropio2Habilitado && (
                  <th className="px-2 py-2 text-left">{idPropio2Label}</th>
                )}
                <th className="px-2 py-2 text-left">Fecha</th>
                {mostrarCliente && (
                  <th className="px-2 py-2 text-left">Cliente</th>
                )}
                <th className="px-2 py-2 text-left">Origen → Destino</th>
                {mostrarProducto && (
                  <th className="px-2 py-2 text-left">Carga</th>
                )}
                {mostrarChofer && (
                  <th className="px-2 py-2 text-left">Chofer</th>
                )}
                {mostrarTransporte && (
                  <th className="px-2 py-2 text-left">Transporte</th>
                )}
                <th className="whitespace-nowrap px-2 py-2 text-right">
                  {montoSinIva
                    ? "Monto (s/IVA)"
                    : `Monto${monedaUnica ? ` (${monedaUnica})` : ""}`}
                </th>
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
                    {idSistemaHabilitado && (
                      <td className="px-2 py-1.5 font-medium text-vialto-charcoal">
                        {v.numero}
                      </td>
                    )}
                    {idPropio1Habilitado && (
                      <td className="px-2 py-1.5 text-vialto-charcoal">
                        {v.numeroIdentificacionPersonalizado?.trim() || "—"}
                      </td>
                    )}
                    {idPropio2Habilitado && (
                      <td className="px-2 py-1.5 text-vialto-charcoal">
                        {v.idPropio2?.trim() || "—"}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-2 py-1.5 text-vialto-steel">
                      {fmtDate(v.fechaCarga)}
                    </td>
                    {mostrarCliente && (
                      <td className="px-2 py-1.5 text-vialto-steel">
                        {v.cliente?.nombre ?? "—"}
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-vialto-steel">
                      {v.origen ?? "—"} → {v.destino ?? "—"}
                    </td>
                    {mostrarProducto && (
                      <td className="px-2 py-1.5 text-vialto-steel">
                        {nombresProductosSeleccion(v)}
                      </td>
                    )}
                    {mostrarChofer && (
                      <td className="px-2 py-1.5 text-vialto-steel">
                        {nombreChoferSeleccion(v)}
                      </td>
                    )}
                    {mostrarTransporte && (
                      <td className="px-2 py-1.5 text-vialto-steel">
                        {v.transportista?.nombre ?? "—"}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-vialto-steel">
                      {renderMonto(v, !monedaUnica)}
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
