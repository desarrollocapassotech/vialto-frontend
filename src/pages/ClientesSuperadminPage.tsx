import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClienteViewModal } from '@/components/clientes/ClienteViewModal';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoToolbar } from '@/components/listado/ListadoToolbar';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { useTenantFiltroUrl } from '@/hooks/useTenantFiltroUrl';
import { useListadoFiltros } from '@/hooks/useListadoFiltros';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { Cliente, ConEmpresa } from '@/types/api';

export function ClientesSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<ConEmpresa<Cliente>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const tenants = useTenantsList();
  const { busqueda, setBusqueda, filtroPais, setFiltroPais, paisesList, rowsFiltradas, onClear, activeFilterCount } = useListadoFiltros(rows, ['nombre', 'idFiscal']);

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
        const data = await apiJson<ConEmpresa<Cliente>[]>(
          `/api/platform/clientes?tenantId=${encodeURIComponent(filtroEmpresa)}`,
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
        Clientes
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver sus clientes. Los datos los filtra el servidor.
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
              ? `/clientes/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : '#'
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? 'bg-vialto-charcoal hover:bg-vialto-graphite'
              : 'bg-vialto-charcoal/50 pointer-events-none'
          }`}
          aria-disabled={!filtroEmpresa}
        >
          Crear cliente
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
      )}

      <ListadoDatos
        className="mt-8"
        columns={[
          {
            id: 'nombre',
            header: 'Nombre',
            primary: true,
            cell: (c) => c.nombre,
            tdClassName: listadoTablaTdClass,
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
            id: 'direccion',
            header: 'Dirección',
            cell: (c) => c.direccion ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'contacto',
            header: 'Contacto',
            cell: (c) => c.email ?? c.telefono ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={!filtroEmpresa || error ? [] : rowsFiltradas}
        rowKey={(c) => c.id}
        emptyMessage={
          !filtroEmpresa
            ? 'Seleccioná una empresa para ver los clientes.'
            : error
              ? 'No se pudieron cargar los clientes.'
              : activeFilterCount > 0
                ? 'No hay clientes que coincidan con los filtros aplicados.'
                : 'No hay clientes cargados para esta empresa.'
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

      {viewingCliente && (
        <ClienteViewModal
          cliente={viewingCliente}
          onClose={() => setViewingCliente(null)}
          editTo={`/clientes/${encodeURIComponent(viewingCliente.id)}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
        />
      )}
    </div>
  );
}
