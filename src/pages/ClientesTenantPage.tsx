import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClienteViewModal } from '@/components/clientes/ClienteViewModal';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoToolbar } from '@/components/listado/ListadoToolbar';
import { useListadoFiltros } from '@/hooks/useListadoFiltros';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
} from '@/lib/listadoTabla';
import type { Cliente, PaginatedMeta } from '@/types/api';

type ClientesPaginatedResponse = {
  items: Cliente[];
  meta: PaginatedMeta;
};

export function ClientesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Cliente[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const { busqueda, setBusqueda, filtroPais, setFiltroPais, paisesList, rowsFiltradas, onClear, activeFilterCount } = useListadoFiltros(rows, ['nombre', 'idFiscal']);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<ClientesPaginatedResponse>(
          `/api/clientes/paginated?page=${page}&pageSize=${pageSize}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data.items);
          setMeta(data.meta);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, 'clientes'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide">
        Clientes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Las empresas o personas a las que les prestás el servicio.
      </p>
      <div className="mt-4 flex justify-end">
        <Link
          to="/clientes/nuevo"
          className="inline-flex min-h-11 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite md:min-h-0 md:h-10"
        >
          Crear cliente
        </Link>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoToolbar
        searchValue={busqueda}
        onSearchChange={setBusqueda}
        searchPlaceholder="Buscar por nombre o ID fiscal"
        filtros={[
          {
            value: filtroPais,
            onChange: setFiltroPais,
            placeholder: 'Todos los países',
            opciones: paisesList.map((p) => ({ value: p, label: p })),
          },
        ]}
        onClear={onClear}
      />

      <ListadoDatos
        className="mt-8"
        columns={[
          {
            id: 'nombre',
            header: 'Nombre',
            primary: true,
            cell: (c) => c.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: 'idFiscal',
            header: 'ID Fiscal',
            cell: (c) => c.idFiscal ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'pais',
            header: 'País',
            cell: (c) => c.pais ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'email',
            header: 'Email',
            cell: (c) => c.email ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'telefono',
            header: 'Teléfono',
            cell: (c) => c.telefono ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rowsFiltradas}
        rowKey={(c) => c.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los clientes.'
            : activeFilterCount > 0
              ? 'No hay clientes que coincidan con los filtros aplicados.'
              : 'Todavía no tenés clientes cargados.'
        }
        loadingMessage="Cargando…"
        renderActions={(c) => (
          <button
            type="button"
            onClick={() => setViewingCliente(c)}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {meta && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-vialto-steel">
              Página {meta.page} de {meta.totalPages} · {meta.total} registros
            </p>
            <label className="text-xs uppercase tracking-wider text-vialto-steel flex items-center gap-2">
              Mostrar
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-11 min-h-11 border border-black/20 bg-white px-2 text-xs sm:h-8 sm:min-h-0"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="inline-flex gap-2">
            <button
              type="button"
              disabled={!meta.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex min-h-11 flex-1 items-center justify-center border border-black/20 px-3 text-xs uppercase tracking-wider disabled:opacity-40 sm:min-h-0 sm:h-9 sm:flex-none"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex min-h-11 flex-1 items-center justify-center border border-black/20 px-3 text-xs uppercase tracking-wider disabled:opacity-40 sm:min-h-0 sm:h-9 sm:flex-none"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {viewingCliente && (
        <ClienteViewModal
          cliente={viewingCliente}
          onClose={() => setViewingCliente(null)}
          editTo={`/clientes/${encodeURIComponent(viewingCliente.id)}/editar`}
        />
      )}
    </div>
  );
}
