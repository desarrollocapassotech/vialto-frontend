import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoToolbar } from '@/components/listado/ListadoToolbar';
import { TransportistaViewModal } from '@/components/transportistas/TransportistaViewModal';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { useTenantFiltroUrl } from '@/hooks/useTenantFiltroUrl';
import { useListadoFiltros } from '@/hooks/useListadoFiltros';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { ConEmpresa, Transportista } from '@/types/api';

export function TransportistasSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<ConEmpresa<Transportista>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const [viewingTransportista, setViewingTransportista] = useState<Transportista | null>(null);
  const tenants = useTenantsList();
  const { busqueda, setBusqueda, filtroPais, setFiltroPais, paisesList, rowsFiltradas, onClear, activeFilterCount } = useListadoFiltros(rows, ['nombre', 'idFiscal', 'paut']);

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
        const data = await apiJson<ConEmpresa<Transportista>[]>(
          `/api/platform/transportistas?tenantId=${encodeURIComponent(filtroEmpresa)}`,
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
        Transportistas
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver y administrar sus transportistas.
      </p>
      <div className="mt-6">
        <EmpresaFilterBar tenants={tenants} value={filtroEmpresa} onChange={onChangeTenant} />
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={
            filtroEmpresa
              ? `/transportistas/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : '#'
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? 'bg-vialto-charcoal hover:bg-vialto-graphite'
              : 'bg-vialto-charcoal/50 pointer-events-none'
          }`}
          aria-disabled={!filtroEmpresa}
        >
          Crear transportista
        </Link>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {filtroEmpresa && !error && (
        <ListadoToolbar
          searchValue={busqueda}
          onSearchChange={setBusqueda}
          searchPlaceholder="Buscar por nombre, ID fiscal o N° PAUT"
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
      )}

      <ListadoDatos
        className="mt-8"
        columns={[
          {
            id: 'nombre',
            header: 'Nombre',
            primary: true,
            cell: (t) => t.nombre,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'idFiscal',
            header: 'ID Fiscal',
            cell: (t) => t.idFiscal ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'pais',
            header: 'País',
            cell: (t) => t.pais ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'contacto',
            header: 'Contacto',
            cell: (t) => t.email ?? t.telefono ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'paut',
            header: 'N° PAUT',
            cell: (t) => t.paut ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={!filtroEmpresa || error ? [] : rowsFiltradas}
        rowKey={(t) => t.id}
        emptyMessage={
          !filtroEmpresa
            ? 'Seleccioná una empresa para ver los transportistas.'
            : error
              ? 'No se pudieron cargar los transportistas.'
              : activeFilterCount > 0
                ? 'No hay transportistas que coincidan con los filtros aplicados.'
                : 'No hay transportistas cargados para esta empresa.'
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

      {viewingTransportista && (
        <TransportistaViewModal
          transportista={viewingTransportista}
          onClose={() => setViewingTransportista(null)}
          editTo={`/transportistas/${encodeURIComponent(viewingTransportista.id)}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
        />
      )}
    </div>
  );
}
