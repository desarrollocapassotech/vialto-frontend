import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { ListadoDatos, type ListadoColumn } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { pageTitleClass } from "@/lib/listadoTabla";
import { useMaestroData } from "@/hooks/useMaestroData";
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

  function handleMonthChange(val: string) {
    setMonth(val);
    setPage(1);
  }

  function handleVehiculoChange(val: string) {
    setVehiculoId(val);
    setPage(1);
  }

  function handleChoferChange(val: string) {
    setChoferId(val);
    setPage(1);
  }

  function handleClearFilters() {
    setMonth("");
    setVehiculoId("");
    setChoferId("");
    setPage(1);
  }

  const hayFiltros = Boolean(month || vehiculoId || choferId);

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
  }, [isLoaded, isSignedIn, page, pageSize, month, vehiculoId, choferId, getToken]);

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
    "h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal";

  const filters = (
    <>
      <ListadoFiltroCampo label="Mes" active={Boolean(month)}>
        <input
          type="month"
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className={`${inputClass} ${month ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por mes"
        />
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Conductor" active={Boolean(choferId)}>
        <select
          value={choferId}
          onChange={(e) => handleChoferChange(e.target.value)}
          className={`${inputClass} ${choferId ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por conductor"
        >
          <option value="">Todos</option>
          {maestro.choferes.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.nombre}
            </option>
          ))}
        </select>
      </ListadoFiltroCampo>

      <ListadoFiltroCampo label="Vehículo" active={Boolean(vehiculoId)}>
        <select
          value={vehiculoId}
          onChange={(e) => handleVehiculoChange(e.target.value)}
          className={`${inputClass} ${vehiculoId ? "text-vialto-fire" : ""}`}
          aria-label="Filtrar por vehículo"
        >
          <option value="">Todos</option>
          {maestro.vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.patente}
            </option>
          ))}
        </select>
      </ListadoFiltroCampo>
    </>
  );

  return (
    <div className="flex flex-col gap-6 py-6 px-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>Combustible</h1>
      </div>

      {/* Filtros inline (desktop) */}
      <div className="hidden lg:flex flex-wrap gap-3 items-end">
        {filters}
        {hayFiltros && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="h-9 px-3 border border-black/15 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
          >
            Limpiar
          </button>
        )}
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
        filters={filters}
        activeFilterCount={[month, vehiculoId, choferId].filter(Boolean).length}
        onClearFilters={handleClearFilters}
        clearFiltersDisabled={!hayFiltros}
        filtersTitle="Filtrar cargas"
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
    </div>
  );
}
