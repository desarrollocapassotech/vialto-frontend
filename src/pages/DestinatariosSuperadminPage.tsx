import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DestinatarioViewModal } from '@/components/destinatarios/DestinatarioViewModal';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { useTenantFiltroUrl } from '@/hooks/useTenantFiltroUrl';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { ConEmpresa, Destinatario } from '@/types/api';

export function DestinatariosSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const [rows, setRows] = useState<ConEmpresa<Destinatario>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingNombre, setViewingNombre] = useState('');
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
        const data = await apiJson<ConEmpresa<Destinatario>[]>(
          `/api/platform/destinatarios?tenantId=${encodeURIComponent(filtroEmpresa)}`,
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
        Destinatarios
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver sus destinatarios de egreso.
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
              ? `/destinatarios/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : '#'
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? 'bg-vialto-charcoal hover:bg-vialto-graphite'
              : 'bg-vialto-charcoal/50 pointer-events-none'
          }`}
          aria-disabled={!filtroEmpresa}
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
          {
            id: 'empresa',
            header: 'Empresa',
            cell: (d) => d.empresaNombre ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={filtroEmpresa ? (error ? [] : rows) : []}
        rowKey={(d) => d.id}
        emptyMessage={
          !filtroEmpresa
            ? 'Seleccioná una empresa para ver destinatarios.'
            : error
              ? 'No se pudieron cargar los destinatarios.'
              : 'No hay destinatarios para esta empresa.'
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
      {viewingId && filtroEmpresa && (
        <DestinatarioViewModal
          destinatarioId={viewingId}
          nombreTitulo={viewingNombre}
          tenantId={filtroEmpresa}
          onClose={() => {
            setViewingId(null);
            setViewingNombre('');
          }}
          editTo={`/destinatarios/${viewingId}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
        />
      )}
    </div>
  );
}
