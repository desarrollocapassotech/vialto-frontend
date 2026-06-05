import { useEffect } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { listadoTablaTdClass, listadoTablaThClass } from '@/lib/listadoTabla';
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
    <ViewModalShell
      title={
        <span className="inline-flex items-center gap-3">
          <span>Viaje #{viaje.numero}</span>
          <span className="text-xs uppercase tracking-[0.1em] border rounded px-2 py-0.5 text-vialto-steel border-black/15">
            {ESTADO_LABEL[viaje.estado] ?? viaje.estado}
          </span>
        </span>
      }
      onClose={onClose}
      maxWidthClass="sm:max-w-2xl"
      scrollBody
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          <button type="button" onClick={onEditar} className={viewModalBtnPrimary}>
            Editar
          </button>
        </>
      }
    >
      <div className="flex flex-col divide-y divide-black/5">
        <div className="flex flex-col gap-4 pb-5">
          <div className={viewModalGridClass}>
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

        <div className="py-5">
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
            <ListadoDatos
              columns={[
                {
                  id: 'descripcion',
                  header: 'Descripción',
                  primary: true,
                  cell: (g) => g.descripcion || '—',
                  tdClassName: listadoTablaTdClass,
                },
                {
                  id: 'fecha',
                  header: 'Fecha',
                  cell: (g) => fmtDate(g.fecha),
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
                },
                {
                  id: 'monto',
                  header: 'Monto',
                  cell: (g) => fmtMonto(g.monto, g.moneda),
                  thClassName: `${listadoTablaThClass} text-right`,
                  tdClassName: `${listadoTablaTdClass} text-right tabular-nums whitespace-nowrap font-medium`,
                },
              ]}
              rows={viaje.otrosGastos}
              rowKey={(g) => `${g.descripcion ?? ''}-${g.fecha ?? ''}-${g.monto ?? ''}`}
              emptyMessage="Sin gastos registrados."
            />
          )}
        </div>

        <div className="pt-5">
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
            <ListadoDatos
              columns={[
                {
                  id: 'fecha',
                  header: 'Fecha',
                  primary: true,
                  cell: (p) => fmtDate(p.fecha),
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
                },
                {
                  id: 'metodo',
                  header: 'Método',
                  cell: (p) => p.metodo || '—',
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
                },
                {
                  id: 'observaciones',
                  header: 'Observaciones',
                  cell: (p) => p.observaciones || '—',
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
                },
                {
                  id: 'monto',
                  header: 'Monto',
                  cell: (p) => fmtMonto(p.monto, p.moneda),
                  thClassName: `${listadoTablaThClass} text-right`,
                  tdClassName: `${listadoTablaTdClass} text-right tabular-nums whitespace-nowrap font-medium`,
                },
              ]}
              rows={viaje.pagosTransportista}
              rowKey={(p) => `${p.fecha ?? ''}-${p.metodo ?? ''}-${p.monto ?? ''}`}
              emptyMessage="Sin pagos registrados."
            />
          )}
        </div>
      </div>
    </ViewModalShell>
  );
}
