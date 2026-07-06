import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DestinatarioViewModal } from '@/components/destinatarios/DestinatarioViewModal';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { Destinatario, PaginatedMeta } from '@/types/api';

type DestinatariosPaginatedResponse = {
  items: Destinatario[];
  meta: PaginatedMeta;
};

export function DestinatariosTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Destinatario[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingNombre, setViewingNombre] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<DestinatariosPaginatedResponse>(
          `/api/destinatarios/paginated?page=${page}&pageSize=${pageSize}`,
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
          setError(friendlyError(e, 'destinatarios'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Destinatarios
      </h1>
      <p className="mt-2 text-vialto-steel">
        Empresas o personas que reciben mercadería en egresos de stock.
      </p>
      <div className="mt-4 flex justify-end">
        <Link
          to="/destinatarios/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear destinatario
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
            cell: (d) => d.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(d) => d.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los destinatarios.'
            : 'Todavía no hay destinatarios cargados.'
        }
        loadingMessage="Cargando…"
        renderActions={(d) => (
          <button
            type="button"
            onClick={() => {
              setViewingId(d.id);
              setViewingNombre(d.nombre);
            }}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {meta && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                className="h-8 border border-black/20 bg-white px-2 text-xs"
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
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {viewingId && (
        <DestinatarioViewModal
          destinatarioId={viewingId}
          nombreTitulo={viewingNombre}
          onClose={() => {
            setViewingId(null);
            setViewingNombre('');
          }}
          editTo={`/destinatarios/${viewingId}/editar`}
        />
      )}
    </div>
  );
}
