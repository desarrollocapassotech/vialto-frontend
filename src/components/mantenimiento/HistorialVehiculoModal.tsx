import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Fuel, Gauge, List, Pencil, Truck } from "lucide-react";
import { EditarKmVehiculoModal } from "@/components/combustible/EditarKmVehiculoModal";
import { EstadoOrdenBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { ViewModalShell, viewModalBtnGhost } from "@/components/ui/ViewModalShell";
import { VehiculoHoverCard } from "@/components/vehiculos/VehiculoHoverCard";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { metaPaginacionCliente, paginasVisibles, slicePaginaCliente } from "@/lib/listadoPaginacion";
import { fmtFecha, fmtFuenteKm, fmtKm, fmtMoneda, fmtOrigenKm, fmtTipoOrden } from "@/lib/mantenimientoLabels";
import type { EventoHistorial, HistorialVehiculo } from "@/types/mantenimiento";

const POR_PAGINA = 5;
type Filtro = "todo" | "orden" | "lectura";

const ICONO_FUENTE = { carga: Fuel, edicion: Pencil } as const;

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-vialto-steel">{label}</dt>
      <dd className="text-sm text-vialto-charcoal">{children}</dd>
    </div>
  );
}

/**
 * Historial de un vehículo: órdenes de trabajo y lecturas de km en una línea de tiempo
 * (`GET mantenimiento/vehiculos/:id/historial`), y "Editar km" (el mismo modal de Combustible,
 * contra `POST vehiculos/:id/km` de core) — clave para empresas sin Combustible.
 */
export function HistorialVehiculoModal({
  vehiculoId,
  soloLectura,
  getToken,
  tenantId,
  onClose,
  onVerOrden,
  onCambio,
}: {
  vehiculoId: string;
  soloLectura: boolean;
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onClose: () => void;
  onVerOrden: (ordenId: string) => void;
  /** Se corrigió el km: el padre recarga los vencimientos. */
  onCambio: () => void;
}) {
  const [data, setData] = useState<HistorialVehiculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("orden");
  const [pagina, setPagina] = useState(1);

  const [editandoKm, setEditandoKm] = useState(false);

  useEffect(() => {
    let cancelado = false;
    apiJson<HistorialVehiculo>(mantUrl(`vehiculos/${encodeURIComponent(vehiculoId)}/historial`, tenantId), () => getToken())
      .then((d) => {
        if (cancelado) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelado && setError(friendlyError(e, "mantenimiento")));
    return () => {
      cancelado = true;
    };
  }, [vehiculoId, tenantId, getToken, recarga]);

  const eventos = useMemo(
    () => (data?.eventos ?? []).filter((e) => filtro === "todo" || e.tipo === filtro),
    [data, filtro],
  );
  const meta = metaPaginacionCliente(eventos.length, pagina, POR_PAGINA);
  const ordenes = (data?.eventos ?? []).filter((e) => e.tipo === "orden");
  const ultimaOrden = ordenes.find((e) => e.tipo === "orden" && e.orden.estado !== "anulada");
  const kmActual = data?.odometro?.km ?? null;

  const titulo = data ? (
    <span>
      Historial · <VehiculoHoverCard vehiculoId={data.vehiculo.id}>{data.vehiculo.patente}</VehiculoHoverCard>
    </span>
  ) : (
    "Historial del vehículo"
  );

  const footer = (
    <button type="button" onClick={onClose} className={viewModalBtnGhost}>
      Cerrar
    </button>
  );

  return (
    <ViewModalShell title={titulo} onClose={onClose} footer={footer} maxWidthClass="sm:max-w-6xl" scrollBody>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !data ? (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      ) : (
        <div className="grid gap-5">
          <dl className="grid grid-cols-1 border border-black/10 bg-vialto-mist/40 sm:grid-cols-3 sm:divide-x sm:divide-black/10">
            <Dato label="Km actual">
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{fmtKm(kmActual)}</span>
                {!soloLectura && (
                  <button
                    type="button"
                    onClick={() => setEditandoKm(true)}
                    className="inline-flex items-center gap-1 text-xs text-vialto-fire hover:underline"
                  >
                    <Gauge className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    Editar km
                  </button>
                )}
                <span className="block w-full text-xs text-vialto-steel">{fmtOrigenKm(data.odometro)}</span>
              </span>
            </Dato>
            <Dato label="Órdenes de trabajo">{ordenes.length}</Dato>
            <Dato label="Última orden">
              {ultimaOrden && ultimaOrden.tipo === "orden"
                ? `${fmtFecha(ultimaOrden.fecha)} · N° ${ultimaOrden.orden.numero}`
                : "—"}
            </Dato>
          </dl>

          {/* Pestañas con el mismo estilo que las de la pantalla de Mantenimiento. */}
          <div className="-mb-5 border-b border-black/15">
            <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist" aria-label="Qué mostrar">
              {(
                [
                  ["orden", "Órdenes de trabajo", ClipboardList],
                  ["lectura", "Lecturas de km", Gauge],
                  ["todo", "Todo", List],
                ] as const
              ).map(([id, label, Icono]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === id}
                  onClick={() => {
                    setFiltro(id);
                    setPagina(1);
                  }}
                  className={[
                    "flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border",
                    filtro === id
                      ? "border-black/15 border-t-2 border-t-vialto-fire border-b-white bg-white text-vialto-charcoal"
                      : "border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  <Icono className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {eventos.length === 0 ? (
            <p className="text-sm text-vialto-steel">
              {filtro === "todo"
                ? "Todavía no hay órdenes ni lecturas de km para este vehículo."
                : filtro === "orden"
                  ? "Todavía no hay órdenes de trabajo para este vehículo."
                  : "Todavía no hay lecturas de km para este vehículo."}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-black/5 border border-black/10 bg-white">
                <li
                  aria-hidden
                  className="hidden items-center gap-3 bg-vialto-mist/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-vialto-steel sm:flex"
                >
                  <span className="w-24 shrink-0">Fecha</span>
                  <span className="w-4 shrink-0" />
                  <span className="flex-1">Evento</span>
                  <span className="w-72 shrink-0">Hecho por</span>
                  <span className="w-28 shrink-0 text-right">Km</span>
                </li>
                {slicePaginaCliente(eventos, pagina, POR_PAGINA).map((e) => (
                  <EventoFila key={claveEvento(e)} evento={e} onVerOrden={onVerOrden} />
                ))}
              </ul>
              {meta.totalPages > 1 && (
                // Mismo paginador liviano que el import (sin selector de tamaño).
                <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-vialto-steel">
                    Página {meta.page} de {meta.totalPages} · {meta.total} {meta.total === 1 ? "registro" : "registros"}
                  </span>
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!meta.hasPrev}
                      onClick={() => setPagina((n) => Math.max(1, n - 1))}
                      className="h-8 min-w-8 border border-black/20 px-2 text-xs uppercase tracking-wider hover:bg-vialto-mist/80 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    {paginasVisibles(meta.page, meta.totalPages).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPagina(n)}
                        aria-current={n === meta.page ? "page" : undefined}
                        className={[
                          "h-8 min-w-8 px-2 border text-xs tabular-nums",
                          n === meta.page
                            ? "border-vialto-charcoal bg-vialto-charcoal text-white"
                            : "border-black/20 text-vialto-charcoal hover:bg-vialto-mist/80",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={!meta.hasNext}
                      onClick={() => setPagina((n) => Math.min(meta.totalPages, n + 1))}
                      className="h-8 min-w-8 border border-black/20 px-2 text-xs uppercase tracking-wider hover:bg-vialto-mist/80 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {editandoKm && data && (
        // El mismo modal que "Editar km" de Combustible, contra la ruta de core.
        <EditarKmVehiculoModal
          url={`/api/vehiculos/${encodeURIComponent(vehiculoId)}/km${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}
          vehiculoId={vehiculoId}
          patente={data.vehiculo.patente}
          kmActual={kmActual ?? 0}
          onClose={() => setEditandoKm(false)}
          onSuccess={() => {
            setEditandoKm(false);
            setRecarga((n) => n + 1);
            onCambio();
          }}
        />
      )}
    </ViewModalShell>
  );
}

function claveEvento(e: EventoHistorial): string {
  return e.tipo === "orden" ? `o-${e.orden.id}` : `l-${e.fuente}-${e.fuenteId}`;
}

function EventoFila({ evento: e, onVerOrden }: { evento: EventoHistorial; onVerOrden: (id: string) => void }) {
  const fecha = <span className="w-24 shrink-0 text-xs tabular-nums text-vialto-steel">{fmtFecha(e.fecha)}</span>;
  // Columna "Hecho por": usuario de Vialto o chofer (app de Combustible).
  const autor = (
    <span className="hidden w-72 shrink-0 truncate text-sm sm:block" title={e.autor?.nombre}>
      {e.autor ? (
        <>
          {e.autor.nombre}
          {e.autor.chofer && <span className="ml-1 text-xs text-vialto-steel">(chofer)</span>}
        </>
      ) : (
        <span className="text-vialto-steel">—</span>
      )}
    </span>
  );
  const km = (valor: number | null, costo?: number) => (
    <span className="w-28 shrink-0 text-right">
      <span className="block tabular-nums">{fmtKm(valor)}</span>
      {costo != null && costo > 0 && <span className="block text-xs tabular-nums text-vialto-steel">{fmtMoneda(costo)}</span>}
    </span>
  );

  if (e.tipo === "lectura") {
    const Icono = ICONO_FUENTE[e.fuente as keyof typeof ICONO_FUENTE] ?? Truck;
    return (
      <li className="flex items-center gap-3 px-3 py-2 text-sm">
        {fecha}
        <Icono className="h-4 w-4 shrink-0 text-vialto-steel/70" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 text-vialto-steel">{fmtFuenteKm(e.fuente)}</span>
        {autor}
        {km(e.km)}
      </li>
    );
  }

  const o = e.orden;
  const detalle = [o.taller?.nombre, o.planes.length ? `Cumple: ${o.planes.map((p) => p.planNombre).join(", ")}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={() => onVerOrden(o.id)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-vialto-mist/60"
      >
        {fecha}
        <ClipboardList className="h-4 w-4 shrink-0 text-vialto-fire" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-medium text-vialto-charcoal">
            OT N° {o.numero} · {fmtTipoOrden(o.tipo)}
            {o.estado === "anulada" && <EstadoOrdenBadge estado={o.estado} />}
          </span>
          {detalle && <span className="block truncate text-xs text-vialto-steel">{detalle}</span>}
        </span>
        {autor}
        {km(o.km, o.costoTotal)}
      </button>
    </li>
  );
}
