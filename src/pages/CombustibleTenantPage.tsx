import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { ListadoDatos, type ListadoColumn } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { pageTitleClass, listadoTablaAccionClass, listadoTablaTdClass } from "@/lib/listadoTabla";
import { useMaestroData } from "@/hooks/useMaestroData";
import { CargaCombustibleViewModal } from "@/components/combustible/CargaCombustibleViewModal";
import type { CargaCombustible, PaginatedMeta } from "@/types/api";

type CombustibleListResponse = {
  cargas: CargaCombustible[];
  total: number;
  page: number;
  limit: number;
};

const FORMA_PAGO_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  cheque: "Cheque",
  efectivo: "Efectivo",
};

const TIPO_VEHICULO_LABELS: Record<string, string> = {
  tractor: "Tractor",
  semirremolque: "Semirremolque",
  camion: "Camión",
  utilitario: "Utilitario",
  otro: "Otro",
};

function fmtVehiculoLabel(v: { patente: string; tipo: string; marca: string | null; modelo: string | null }): string {
  const tipo = TIPO_VEHICULO_LABELS[v.tipo] ?? v.tipo;
  const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
  const detalle = [tipo, marcaModelo].filter(Boolean).join(" · ");
  return detalle ? `${v.patente} — ${detalle}` : v.patente;
}

function fmtFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function fmtNum(n: number) {
  return n.toLocaleString("es-AR");
}

function fmtFormaPago(v: string | null) {
  if (!v) return "—";
  return FORMA_PAGO_LABELS[v] ?? v;
}

const COLUMNS: ListadoColumn<CargaCombustible>[] = [
  {
    id: "fecha",
    header: "Fecha",
    primary: true,
    cell: (r) => fmtFecha(r.fecha),
  },
  {
    id: "chofer",
    header: "Conductor",
    cell: (r) => r.chofer?.nombre ?? "—",
  },
  {
    id: "vehiculo",
    header: "Vehículo",
    cell: (r) => r.vehiculo?.patente ?? r.vehiculoId,
  },
  {
    id: "estacion",
    header: "Estación",
    cell: (r) => r.estacion,
    showInCard: false,
  },
  {
    id: "litros",
    header: "Litros",
    cell: (r) => `${fmtNum(r.litros)} L`,
  },
  {
    id: "precioPorLitro",
    header: "Precio/L",
    cell: (r) => r.precioPorLitro != null ? `$${fmtNum(r.precioPorLitro)}` : "—",
  },
  {
    id: "importe",
    header: "Monto",
    cell: (r) => `$${fmtNum(r.importe)}`,
  },
  {
    id: "km",
    header: "Km",
    cell: (r) => fmtNum(r.km),
    showInCard: false,
  },
  {
    id: "formaPago",
    header: "Forma de pago",
    cell: (r) => fmtFormaPago(r.formaPago),
    showInCard: false,
  },
];

export function CombustibleTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const maestro = useMaestroData();

  const [rows, setRows] = useState<CargaCombustible[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [choferId, setChoferId] = useState("");
  const [estacion, setEstacion] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [viewingCargaId, setViewingCargaId] = useState<string | null>(null);

  function resetPage() { setPage(1); }

  function handleClearFilters() {
    setMonth("");
    setVehiculoId("");
    setChoferId("");
    setEstacion("");
    setFormaPago("");
    setPage(1);
  }

  const hayFiltros = Boolean(month || vehiculoId || choferId || estacion || formaPago);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setRows(null);

    void (async () => {
      try {
        const qs = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (month) qs.set("month", month);
        if (vehiculoId) qs.set("vehiculoId", vehiculoId);
        if (choferId) qs.set("choferId", choferId);
        if (estacion) qs.set("estacion", estacion);
        if (formaPago) qs.set("formaPago", formaPago);

        const data = await apiJson<CombustibleListResponse>(
          `/api/combustible?${qs.toString()}`,
          () => getToken(),
        );

        if (!cancelled) {
          setRows(data.cargas);
          setTotal(data.total);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(friendlyError(e, "combustible"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, page, pageSize, month, vehiculoId, choferId, estacion, formaPago, getToken]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const meta: PaginatedMeta = {
    page,
    pageSize,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };

  const inputClass =
    "h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none";

  // Filtros para el drawer móvil
  const mobileFilters = (
    <>
      <ListadoFiltroCampo label="Mes" active={Boolean(month)}>
        <input
          type="month"
          value={month}
          onChange={(e) => { setMonth(e.target.value); resetPage(); }}
          className={`${inputClass} ${month ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por mes"
        />
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Conductor" active={Boolean(choferId)}>
        <select
          value={choferId}
          onChange={(e) => { setChoferId(e.target.value); resetPage(); }}
          className={`${inputClass} ${choferId ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por conductor"
        >
          <option value="">Todos</option>
          {maestro.choferes.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.nombre}</option>
          ))}
        </select>
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Vehículo" active={Boolean(vehiculoId)}>
        <select
          value={vehiculoId}
          onChange={(e) => { setVehiculoId(e.target.value); resetPage(); }}
          className={`${inputClass} ${vehiculoId ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por vehículo"
        >
          <option value="">Todos</option>
          {maestro.vehiculos.map((v) => (
            <option key={v.id} value={v.id}>{fmtVehiculoLabel(v)}</option>
          ))}
        </select>
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Estación" active={Boolean(estacion)}>
        <input
          type="text"
          value={estacion}
          onChange={(e) => { setEstacion(e.target.value); resetPage(); }}
          placeholder="Buscar estación..."
          className={`${inputClass} ${estacion ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por estación"
        />
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Forma de pago" active={Boolean(formaPago)}>
        <select
          value={formaPago}
          onChange={(e) => { setFormaPago(e.target.value); resetPage(); }}
          className={`${inputClass} ${formaPago ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por forma de pago"
        >
          <option value="">Todas</option>
          {Object.entries(FORMA_PAGO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </ListadoFiltroCampo>
    </>
  );

  // Encabezado de tabla con filtros por columna (desktop)
  // tableHead se renderiza dentro del <thead> que provee ListadoDatos — solo el <tr>
  const tableHead = (
    <tr className="border-b border-black/10">
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Fecha"
          filterActive={Boolean(month)}
          filterSignature={month}
        >
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); resetPage(); }}
            className={`${inputClass} min-w-[150px]`}
            aria-label="Filtrar por mes"
          />
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Conductor"
          filterActive={Boolean(choferId)}
          filterSignature={choferId}
        >
          <select
            value={choferId}
            onChange={(e) => { setChoferId(e.target.value); resetPage(); }}
            className={`${inputClass} min-w-[160px]`}
            aria-label="Filtrar por conductor"
          >
            <option value="">Todos</option>
            {maestro.choferes.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.nombre}</option>
            ))}
          </select>
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Vehículo"
          filterActive={Boolean(vehiculoId)}
          filterSignature={vehiculoId}
        >
          <select
            value={vehiculoId}
            onChange={(e) => { setVehiculoId(e.target.value); resetPage(); }}
            className={`${inputClass} min-w-[140px]`}
            aria-label="Filtrar por vehículo"
          >
            <option value="">Todos</option>
            {maestro.vehiculos.map((v) => (
              <option key={v.id} value={v.id}>{fmtVehiculoLabel(v)}</option>
            ))}
          </select>
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Estación"
          filterActive={Boolean(estacion)}
          filterSignature={estacion}
        >
          <input
            type="text"
            value={estacion}
            onChange={(e) => { setEstacion(e.target.value); resetPage(); }}
            placeholder="Buscar..."
            className={`${inputClass} min-w-[140px]`}
            aria-label="Filtrar por estación"
          />
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Litros
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Precio/L
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Monto
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Km
        </span>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <ViajesListadoHeaderFiltro
          title="Forma de pago"
          filterActive={Boolean(formaPago)}
          filterSignature={formaPago}
        >
          <select
            value={formaPago}
            onChange={(e) => { setFormaPago(e.target.value); resetPage(); }}
            className={`${inputClass} min-w-[150px]`}
            aria-label="Filtrar por forma de pago"
          >
            <option value="">Todas</option>
            {Object.entries(FORMA_PAGO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </ViajesListadoHeaderFiltro>
      </th>
      <th className="px-4 py-3 text-left font-normal">
        <span className="text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          Acciones
        </span>
      </th>
    </tr>
  );

  const cantFiltros = [month, vehiculoId, choferId, estacion, formaPago].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6 py-6 px-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>Combustible</h1>
        <div className="hidden min-h-10 items-center lg:flex">
          {hayFiltros && (
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={rows === null}
              className="inline-flex h-10 items-center gap-2 px-4 border border-black/15 bg-white text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50 disabled:pointer-events-none"
              aria-label={`Limpiar filtros (${cantFiltros} activo${cantFiltros !== 1 ? "s" : ""})`}
            >
              Limpiar filtros
              <span
                className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-vialto-fire px-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold tabular-nums leading-none text-white"
                aria-hidden
              >
                {cantFiltros}
              </span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ListadoDatos<CargaCombustible>
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="Sin cargas registradas"
        filters={mobileFilters}
        activeFilterCount={[month, vehiculoId, choferId, estacion, formaPago].filter(Boolean).length}
        onClearFilters={handleClearFilters}
        clearFiltersDisabled={!hayFiltros}
        filtersTitle="Filtrar cargas"
        tableHead={tableHead}
        actionsTdClassName={listadoTablaTdClass}
        renderActions={(c) => (
          <button
            type="button"
            onClick={() => setViewingCargaId(c.id)}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {rows !== null && total > 0 && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={rows === null}
          totalLabel="cargas"
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      )}

      {viewingCargaId && (
        <CargaCombustibleViewModal
          cargaId={viewingCargaId}
          onClose={() => setViewingCargaId(null)}
        />
      )}
    </div>
  );
}
