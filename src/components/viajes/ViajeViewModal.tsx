import { useEffect } from 'react';
import type { Viaje } from '@/types/api';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMonto(monto: number | null | undefined, moneda?: string | null) {
  if (monto == null) return '—';
  const prefix = moneda === 'USD' ? 'USD ' : '$ ';
  return `${prefix}${monto.toLocaleString('es-AR')}`;
}

function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}


const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export function ViajeViewModal({
  viaje,
  onClose,
  onEditar,
}: {
  viaje: Viaje;
  onClose: () => void;
  onEditar: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const clienteNombre = viaje.cliente?.nombre ?? viaje.clienteId;
  const transportistaNombre = viaje.transportista?.nombre ?? (viaje.transportistaId ? viaje.transportistaId : '—');
  const vehiculoPatentes = viaje.vehiculosViaje?.map((v) => v.vehiculo.patente).join(', ') ?? null;
  const productosDesc = viaje.productosViaje
    ?.map((p) => `${p.producto.nombre}${p.cantidad ? ` × ${p.cantidad}` : ''}`)
    .join(', ') ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded border border-black/10 bg-white shadow-lg flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              Viaje #{viaje.numero}
            </h2>
            <span className="text-xs uppercase tracking-[0.1em] border rounded px-2 py-0.5 text-vialto-steel border-black/15">
              {ESTADO_LABEL[viaje.estado] ?? viaje.estado}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex flex-col divide-y divide-black/5">

          {/* Datos principales */}
          {(() => {
            const campos = [
              { label: 'Cliente', value: clienteNombre },
              { label: 'Transportista', value: viaje.transportistaId ? transportistaNombre : 'Flota propia' },
              { label: 'Origen', value: viaje.origen },
              { label: 'Destino', value: viaje.destino },
              { label: 'Fecha de carga', value: viaje.fechaCarga ? fmtDate(viaje.fechaCarga) : null },
              { label: 'Fecha de descarga', value: viaje.fechaDescarga ? fmtDate(viaje.fechaDescarga) : null },
              { label: 'Vehículos', value: vehiculoPatentes },
              { label: 'Productos', value: productosDesc },
              { label: 'Monto cliente', value: viaje.monto != null ? fmtMonto(viaje.monto, viaje.monedaMonto) : null },
              { label: 'Precio transportista', value: viaje.precioTransportistaExterno != null ? fmtMonto(viaje.precioTransportistaExterno, viaje.monedaPrecioTransportistaExterno) : null },
              { label: 'KM recorridos', value: viaje.kmRecorridos },
              { label: 'Litros consumidos', value: viaje.litrosConsumidos },
              { label: 'Fecha finalizado', value: viaje.fechaFinalizado ? fmtDate(viaje.fechaFinalizado) : null },
            ].filter((c) => c.value != null && c.value !== '');
            return (
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {campos.map((c, i) => (
                    <div key={i}>
                      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
                      <p className="mt-1 text-sm">{c.value}</p>
                    </div>
                  ))}
                </div>
                {viaje.detalleCarga && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Detalle de carga</p>
                    <p className="mt-1 text-sm">{viaje.detalleCarga}</p>
                  </div>
                )}
                {viaje.observaciones && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Observaciones</p>
                    <p className="mt-1 text-sm">{viaje.observaciones}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Historial de gastos */}
          <div className="px-6 py-5">
            <p className="text-xs uppercase tracking-[0.12em] text-vialto-steel mb-3">
              Gastos adicionales
              {viaje.otrosGastos && viaje.otrosGastos.length > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal">
                  ({viaje.otrosGastos.length})
                </span>
              )}
            </p>
            {!viaje.otrosGastos || viaje.otrosGastos.length === 0 ? (
              <p className="text-sm text-vialto-steel/70">Sin gastos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs uppercase tracking-[0.08em] text-vialto-steel">
                    <th className="pb-2 text-left font-normal">Descripción</th>
                    <th className="pb-2 text-left font-normal">Fecha</th>
                    <th className="pb-2 text-right font-normal">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {viaje.otrosGastos.map((g, i) => (
                    <tr key={i} className="border-b border-black/5 last:border-0">
                      <td className="py-2 pr-4">{g.descripcion || '—'}</td>
                      <td className="py-2 pr-4 text-vialto-steel whitespace-nowrap">{fmtDate(g.fecha)}</td>
                      <td className="py-2 text-right tabular-nums whitespace-nowrap font-medium">
                        {fmtMonto(g.monto, g.moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Historial de pagos al transportista */}
          <div className="px-6 py-5">
            <p className="text-xs uppercase tracking-[0.12em] text-vialto-steel mb-3">
              Pagos al transportista
              {viaje.pagosTransportista && viaje.pagosTransportista.length > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal">
                  ({viaje.pagosTransportista.length})
                </span>
              )}
            </p>
            {!viaje.pagosTransportista || viaje.pagosTransportista.length === 0 ? (
              <p className="text-sm text-vialto-steel/70">Sin pagos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs uppercase tracking-[0.08em] text-vialto-steel">
                    <th className="pb-2 text-left font-normal">Fecha</th>
                    <th className="pb-2 text-left font-normal">Método</th>
                    <th className="pb-2 text-left font-normal">Observaciones</th>
                    <th className="pb-2 text-right font-normal">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {viaje.pagosTransportista.map((p, i) => (
                    <tr key={i} className="border-b border-black/5 last:border-0">
                      <td className="py-2 pr-4 text-vialto-steel whitespace-nowrap">{fmtDate(p.fecha)}</td>
                      <td className="py-2 pr-4 text-vialto-steel">{p.metodo || '—'}</td>
                      <td className="py-2 pr-4 text-vialto-steel">{p.observaciones || '—'}</td>
                      <td className="py-2 text-right tabular-nums whitespace-nowrap font-medium">
                        {fmtMonto(p.monto, p.moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}
