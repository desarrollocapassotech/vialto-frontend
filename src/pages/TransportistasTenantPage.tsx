import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoPagination } from '@/components/listado/ListadoPagination';
import { TransportistaViewModal } from '@/components/transportistas/TransportistaViewModal';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { pageSizeListadoValido } from '@/lib/listadoPaginacion';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { PaginatedMeta, Transportista } from '@/types/api';

type TransportistasPaginatedResponse = {
  items: Transportista[];
  meta: PaginatedMeta;
};

export function TransportistasTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Transportista[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listadoRefetching, setListadoRefetching] = useState(false);
  const [viewingTransportista, setViewingTransportista] = useState<Transportista | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const pageApi = Math.max(1, Math.floor(page));
        const pageSizeApi = pageSizeListadoValido(pageSize);
        const data = await apiJson<TransportistasPaginatedResponse>(
          `/api/transportistas/paginated?page=${pageApi}&pageSize=${pageSizeApi}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data.items);
          setMeta(data.meta);
          setError(null);
          setListadoRefetching(false);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, 'transportistas'));
          setListadoRefetching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);

  function irAPagina(nuevaPagina: number) {
    setListadoRefetching(true);
    setPage(Math.max(1, nuevaPagina));
  }

  function cambiarPageSize(nuevoSize: number) {
    setListadoRefetching(true);
    setPageSize(nuevoSize);
    setPage(1);
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Transportistas externos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Gestión de los transportistas externos (fleteros).
      </p>
      <div className="mt-4 flex justify-end">
        <Link
          to="/transportistas/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear transportista
        </Link>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className="mt-8"
        columns={[
          {
            id: 'nombre',
            header: 'Nombre',
            primary: true,
            cell: (t) => t.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: 'idFiscal',
            header: 'ID Fiscal',
            cell: (t) => t.idFiscal ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'email',
            header: 'Email',
            cell: (t) => t.email ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'telefono',
            header: 'Teléfono',
            cell: (t) => t.telefono ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(t) => t.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los transportistas.'
            : 'Todavía no hay transportistas cargados.'
        }
        loadingMessage="Cargando…"
        renderActions={(t) => (
          <button
            type="button"
            onClick={() => setViewingTransportista(t)}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {meta && meta.total > 0 && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={listadoRefetching}
          totalLabel="transportistas"
          onPageChange={irAPagina}
          onPageSizeChange={cambiarPageSize}
        />
      )}

      {viewingTransportista && (
        <TransportistaViewModal
          transportista={viewingTransportista}
          onClose={() => setViewingTransportista(null)}
          editTo={`/transportistas/${encodeURIComponent(viewingTransportista.id)}/editar`}
        />
      )}
    </div>
  );
}
