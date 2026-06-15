import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { TransportistaViewModal } from '@/components/transportistas/TransportistaViewModal';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import type { Transportista } from '@/types/api';

export function TransportistasTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Transportista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingTransportista, setViewingTransportista] = useState<Transportista | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Transportista[]>('/api/transportistas', () =>
          getToken(),
        );
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'transportistas'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Transportistas externos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Gestión de los transportistas externos (fleteros).
      </p>
      <div className="mt-4 flex justify-end">
        <Link
          to="/transportistas/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear transportista
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
            cell: (t) => t.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: 'idFiscal',
            header: 'ID Fiscal',
            cell: (t) => t.idFiscal ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'email',
            header: 'Email',
            cell: (t) => t.email ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'telefono',
            header: 'Teléfono',
            cell: (t) => t.telefono ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(t) => t.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los transportistas.'
            : 'Todavía no hay transportistas cargados.'
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
          editTo={`/transportistas/${encodeURIComponent(viewingTransportista.id)}/editar`}
        />
      )}
    </div>
  );
}
