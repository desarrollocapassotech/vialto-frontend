import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { estadoViajeLabel } from '@/lib/viajesEstados';
import type { ConEmpresa, Viaje } from '@/types/api';

export function ViajesSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<ConEmpresa<Viaje>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const tenants = useTenantsList();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    (async () => {
      try {
        const data = await apiJson<ConEmpresa<Viaje>[]>(
          `/api/platform/viajes?tenantId=${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'plataforma'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Viajes
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para listar viajes de esa org. El filtro lo aplica el
        servidor.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={setFiltroEmpresa}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={
            filtroEmpresa
              ? `/viajes/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : '#'
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? 'bg-vialto-charcoal hover:bg-vialto-graphite'
              : 'bg-vialto-charcoal/50 pointer-events-none'
          }`}
          aria-disabled={!filtroEmpresa}
        >
          Crear viaje
        </Link>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3 text-right">Margen</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!filtroEmpresa && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-vialto-steel">
                  Seleccioná una empresa para ver los viajes.
                </td>
              </tr>
            )}
            {filtroEmpresa && rows === null && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {filtroEmpresa && rows !== null && rows.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-vialto-steel">
                  No hay viajes registrados para esta empresa.
                </td>
              </tr>
            )}
            {filtroEmpresa &&
              rows?.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-black/5 hover:bg-vialto-mist/80"
                >
                  <td className="px-4 py-3 font-medium">{v.numero}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 bg-vialto-charcoal text-white">
                      {estadoViajeLabel[v.estado] ?? 'Sin clasificar'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-vialto-steel max-w-[160px] truncate">
                    {v.origen ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-vialto-steel max-w-[160px] truncate">
                    {v.destino ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {v.gananciaBruta != null
                      ? `$ ${v.gananciaBruta.toLocaleString('es-AR')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/viajes/${encodeURIComponent(v.id)}/editar?tenantId=${encodeURIComponent(
                        filtroEmpresa,
                      )}`}
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
    </div>
  );
}
