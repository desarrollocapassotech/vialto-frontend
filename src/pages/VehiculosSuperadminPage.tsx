import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { VehiculoViewModal } from '@/components/vehiculos/VehiculoViewModal';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { useTransportistasList } from '@/hooks/useTransportistasList';
import { useTenantFiltroUrl } from '@/hooks/useTenantFiltroUrl';
import { apiJson } from '@/lib/api';
import { labelVehiculoTipo } from '@/lib/labels';
import { labelAsignacionTransportista, mapTransportistaNombres } from '@/lib/transportistas';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { ConEmpresa, Vehiculo } from '@/types/api';

export function VehiculosSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
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
  const [viewingVehiculoId, setViewingVehiculoId] = useState<string | null>(null);
  const [viewingVehiculoPatente, setViewingVehiculoPatente] = useState('');
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
          onChange={onChangeTenant}
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
            id: 'tipoMarca',
            header: 'Tipo y marca',
            cell: (v) => (
              <>
                {labelVehiculoTipo(v.tipo)}
                {v.marca ? ` · ${v.marca}` : ''}
              </>
            ),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'pertenencia',
            header: 'Pertenencia',
            cell: (v) => labelAsignacionTransportista(v.transportistaId, nombresTransportistas),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={!filtroEmpresa || error ? [] : rows}
        rowKey={(v) => v.id}
        emptyMessage={
          !filtroEmpresa
            ? 'Seleccioná una empresa para ver los vehículos.'
            : error
              ? 'No se pudieron cargar los vehículos.'
              : 'No hay vehículos cargados para esta empresa.'
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
              to={`/vehiculos/${encodeURIComponent(v.id)}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
              className={listadoTablaAccionClass}
            >
              Editar
            </Link>
          </div>
        )}
      />

      {viewingVehiculoId && (
        <VehiculoViewModal
          vehiculoId={viewingVehiculoId}
          patenteTitulo={viewingVehiculoPatente}
          tenantId={filtroEmpresa}
          onClose={() => {
            setViewingVehiculoId(null);
            setViewingVehiculoPatente('');
          }}
          editTo={`/vehiculos/${encodeURIComponent(viewingVehiculoId)}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
        />
      )}
    </div>
  );
}
