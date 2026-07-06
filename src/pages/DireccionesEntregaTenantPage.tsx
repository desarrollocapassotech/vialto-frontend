import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DireccionEntregaViewModal } from '@/components/direcciones-entrega/DireccionEntregaViewModal';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { DireccionEntrega, PaginatedMeta } from '@/types/api';

type DireccionesPaginatedResponse = {
  items: DireccionEntrega[];
  meta: PaginatedMeta;
};

export function DireccionesEntregaTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<DireccionEntrega[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingDireccion, setViewingDireccion] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<DireccionesPaginatedResponse>(
          `/api/direcciones-entrega/paginated?page=${page}&pageSize=${pageSize}`,
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
          setError(friendlyError(e, 'direccionesEntrega'));
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
        Direcciones / Ruta de entrega
      </h1>
      <p className="mt-2 text-vialto-steel">
        Direcciones y rutas frecuentes para egresos de stock.
      </p>
      <div className="mt-4 flex justify-end">
        <Link
          to="/direcciones-entrega/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear dirección
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
            id: 'direccion',
            header: 'Dirección / Ruta',
            primary: true,
            cell: (d) => d.direccion,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(d) => d.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar las direcciones.'
            : 'Todavía no hay direcciones cargadas.'
        }
        loadingMessage="Cargando…"
        renderActions={(d) => (
          <button
            type="button"
            onClick={() => {
              setViewingId(d.id);
              setViewingDireccion(d.direccion);
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
        <DireccionEntregaViewModal
          direccionEntregaId={viewingId}
          direccionTitulo={viewingDireccion}
          onClose={() => {
            setViewingId(null);
            setViewingDireccion('');
          }}
          editTo={`/direcciones-entrega/${viewingId}/editar`}
        />
      )}
    </div>
  );
}
