import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { useTransportistasList } from '@/hooks/useTransportistasList';
import { apiJson } from '@/lib/api';
import { labelVehiculoTipo } from '@/lib/labels';
import { labelAsignacionTransportista, mapTransportistaNombres } from '@/lib/transportistas';
import { friendlyError } from '@/lib/friendlyError';
import type { ConEmpresa, Vehiculo } from '@/types/api';

export function VehiculosSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const transportistas = useTransportistasList(
    filtroEmpresa || undefined,
    !filtroEmpresa,
  );
  const nombresTransportistas = useMemo(
    () => mapTransportistaNombres(transportistas ?? []),
    [transportistas],
  );
  const [rows, setRows] = useState<ConEmpresa<Vehiculo>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        const data = await apiJson<ConEmpresa<Vehiculo>[]>(
          `/api/platform/vehiculos?tenantId=${encodeURIComponent(filtroEmpresa)}`,
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
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Vehículos
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver sus vehículos. El listado lo filtra el
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
              ? `/vehiculos/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : '#'
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? 'bg-vialto-charcoal hover:bg-vialto-graphite'
              : 'bg-vialto-charcoal/50 pointer-events-none'
          }`}
          aria-disabled={!filtroEmpresa}
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
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Patente</th>
              <th className="px-4 py-3">Tipo y marca</th>
              <th className="px-4 py-3">Pertenencia</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!filtroEmpresa && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-vialto-steel">
                  Seleccioná una empresa para ver los vehículos.
                </td>
              </tr>
            )}
            {filtroEmpresa && rows === null && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {filtroEmpresa && rows !== null && rows.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-vialto-steel">
                  No hay vehículos cargados para esta empresa.
                </td>
              </tr>
            )}
            {filtroEmpresa &&
              rows?.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-black/5 hover:bg-vialto-mist/80"
                >
                  <td className="px-4 py-3 font-[family-name:var(--font-ui)] tracking-wider font-semibold">
                    {v.patente}
                  </td>
                  <td className="px-4 py-3 text-vialto-steel">
                    {labelVehiculoTipo(v.tipo)}
                    {v.marca ? ` · ${v.marca}` : ''}
                  </td>
                  <td className="px-4 py-3 text-vialto-steel">
                    {labelAsignacionTransportista(v.transportistaId, nombresTransportistas)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/vehiculos/${encodeURIComponent(v.id)}/editar?tenantId=${encodeURIComponent(
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
