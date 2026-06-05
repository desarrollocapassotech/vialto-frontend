import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { VehiculoViewModal } from '@/components/vehiculos/VehiculoViewModal';
import { apiJson } from '@/lib/api';
import { labelVehiculoTipo } from '@/lib/labels';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { PaginatedMeta, Vehiculo } from '@/types/api';

type VehiculosPaginatedResponse = {
  items: Vehiculo[];
  meta: PaginatedMeta;
};

export function VehiculosTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Vehiculo[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingVehiculoId, setViewingVehiculoId] = useState<string | null>(null);
  const [viewingVehiculoPatente, setViewingVehiculoPatente] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<VehiculosPaginatedResponse>(
          `/api/vehiculos/paginated?page=${page}&pageSize=${pageSize}`,
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
          setError(friendlyError(e, 'vehiculos'));
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
        Vehículos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Patentes, tipo y marca de cada unidad de tu flota.
      </p>
      <div className="mt-4 flex justify-end">
        <Link
          to="/vehiculos/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear vehículo
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
            id: 'patente',
            header: 'Patente',
            primary: true,
            cell: (v) => v.patente,
            tdClassName: `${listadoTablaTdClass} font-[family-name:var(--font-ui)] tracking-wider font-semibold`,
          },
          {
            id: 'tipo',
            header: 'Tipo',
            cell: (v) => labelVehiculoTipo(v.tipo),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'marca',
            header: 'Marca',
            cell: (v) => v.marca ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'modelo',
            header: 'Modelo',
            cell: (v) => v.modelo ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(v) => v.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los vehículos.'
            : 'Todavía no tenés vehículos cargados.'
        }
        loadingMessage="Cargando…"
        renderActions={(v) => (
          <div className="inline-flex gap-2">
            <button
              type="button"
              onClick={() => {
                setViewingVehiculoId(v.id);
                setViewingVehiculoPatente(v.patente);
              }}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
            <Link
              to={`/vehiculos/${encodeURIComponent(v.id)}/editar`}
              className={listadoTablaAccionClass}
            >
              Editar
            </Link>
          </div>
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

      {viewingVehiculoId && (
        <VehiculoViewModal
          vehiculoId={viewingVehiculoId}
          patenteTitulo={viewingVehiculoPatente}
          onClose={() => {
            setViewingVehiculoId(null);
            setViewingVehiculoPatente('');
          }}
          editTo={`/vehiculos/${encodeURIComponent(viewingVehiculoId)}/editar`}
        />
      )}
    </div>
  );
}
