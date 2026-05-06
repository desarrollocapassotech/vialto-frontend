import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTransportistasList } from '@/hooks/useTransportistasList';
import { apiJson } from '@/lib/api';
import { labelVehiculoTipo } from '@/lib/labels';
import { labelAsignacionTransportista, mapTransportistaNombres } from '@/lib/transportistas';
import { friendlyError } from '@/lib/friendlyError';
import type { PaginatedMeta, Vehiculo } from '@/types/api';

type VehiculosPaginatedResponse = {
  items: Vehiculo[];
  meta: PaginatedMeta;
};

export function VehiculosTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const transportistas = useTransportistasList();
  const nombresTransportistas = useMemo(
    () => mapTransportistaNombres(transportistas ?? []),
    [transportistas],
  );
  const [rows, setRows] = useState<Vehiculo[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
      <div className="mt-8 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Patente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Marca</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Pertenencia</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-vialto-steel">
                  Todavía no tenés vehículos cargados.
                </td>
              </tr>
            )}
            {rows?.map((v) => (
              <tr key={v.id} className="border-b border-black/5 hover:bg-vialto-mist/80">
                <td className="px-4 py-3 font-[family-name:var(--font-ui)] tracking-wider font-semibold">
                  {v.patente}
                </td>
                <td className="px-4 py-3 text-vialto-steel">{labelVehiculoTipo(v.tipo)}</td>
                <td className="px-4 py-3 text-vialto-steel">{v.marca ?? '—'}</td>
                <td className="px-4 py-3 text-vialto-steel">{v.modelo ?? '—'}</td>
                <td className="px-4 py-3 text-vialto-steel">
                  {labelAsignacionTransportista(v.transportistaId, nombresTransportistas)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/vehiculos/${encodeURIComponent(v.id)}/editar`}
                    className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
