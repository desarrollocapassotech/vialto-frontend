import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { labelVehiculoTipo } from '@/lib/labels';
import type { Vehiculo } from '@/types/api';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function vehiculoDetailUrl(id: string, tenantId?: string): string {
  if (tenantId?.trim()) {
    return `/api/platform/vehiculos/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId.trim())}`;
  }
  return `/api/vehiculos/${encodeURIComponent(id)}`;
}

export function VehiculoViewModal({
  vehiculoId,
  patenteTitulo,
  tenantId,
  onClose,
  editTo,
}: {
  vehiculoId: string;
  /** Mientras carga el detalle (p. ej. patente del listado). */
  patenteTitulo?: string;
  tenantId?: string;
  onClose: () => void;
  editTo: string;
}) {
  const { getToken } = useAuth();
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const row = await apiJson<Vehiculo>(vehiculoDetailUrl(vehiculoId, tenantId), () => getToken());
        if (!cancelled) {
          setVehiculo(row);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setVehiculo(null);
          setError(friendlyError(e, 'vehiculos'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, vehiculoId, tenantId]);

  const titulo = vehiculo?.patente ?? patenteTitulo ?? 'Vehículo';
  const anio = vehiculo ? (vehiculo.año ?? vehiculo.anio) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide font-[family-name:var(--font-ui)]">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>

        {loading && (
          <p className="px-6 py-8 text-sm text-vialto-steel">Cargando detalle…</p>
        )}
        {error && (
          <p className="mx-6 my-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
        {!loading && vehiculo && (
          <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              { label: 'Patente', value: vehiculo.patente },
              { label: 'Tipo', value: labelVehiculoTipo(vehiculo.tipo) },
              { label: 'Marca', value: vehiculo.marca },
              { label: 'Modelo', value: vehiculo.modelo },
              { label: 'Año', value: anio },
              { label: 'KM actual', value: vehiculo.kmActual },
              { label: 'N.° Chasis', value: vehiculo.nroChasis },
              { label: 'Póliza', value: vehiculo.poliza },
              {
                label: 'Vto. Póliza',
                value: vehiculo.vencimientoPoliza ? fmtDate(vehiculo.vencimientoPoliza) : null,
              },
              { label: 'Tara (kg)', value: vehiculo.tara },
              { label: 'Precinto', value: vehiculo.precinto },
              { label: 'Alta', value: fmtDate(vehiculo.createdAt) },
            ]
              .filter((c) => c.value != null && c.value !== '')
              .map((c, i) => (
                <div key={i}>
                  <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
                  <p className="mt-1 text-sm">{c.value}</p>
                </div>
              ))}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-black/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cerrar
          </button>
          <Link
            to={editTo}
            className="inline-flex h-9 items-center px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
          >
            Editar
          </Link>
        </div>
      </div>
    </div>
  );
}
