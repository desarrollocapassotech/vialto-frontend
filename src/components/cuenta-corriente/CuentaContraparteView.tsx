import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
} from '@/lib/listadoTabla';
import { formatCurrencyArFromNumber } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import {
  fetchMovimientos,
  fetchSaldoCliente,
  fetchSaldoProveedor,
  ESTADO_DISPONIBILIDAD_LABEL,
  ESTADO_IMPUTACION_LABEL,
  type MovimientoCc,
  type SaldoPorMoneda,
  type TipoContraparte,
  type TipoMovimientoCc,
} from '@/lib/cuentaCorriente';
import { MovimientoCcFormModal } from './MovimientoCcFormModal';
import { ImputarPagoModal } from './ImputarPagoModal';

type ModalState =
  | { kind: 'nuevo'; tipoInicial: TipoMovimientoCc }
  | { kind: 'imputar'; cargo: MovimientoCc }
  | null;

const badgeBase = 'inline-block rounded-full px-2 py-0.5 text-xs font-medium';

function EstadoBadge({ movimiento }: { movimiento: MovimientoCc }) {
  if (movimiento.tipo === 'cargo') {
    const estado = movimiento.estadoDisponibilidad;
    const cls =
      estado === 'cancelado'
        ? 'bg-green-100 text-green-800'
        : estado === 'parcial'
          ? 'bg-amber-100 text-amber-800'
          : estado === 'anulado'
            ? 'bg-gray-200 text-gray-600'
            : 'bg-red-100 text-red-800';
    return <span className={`${badgeBase} ${cls}`}>{ESTADO_DISPONIBILIDAD_LABEL[estado] ?? estado}</span>;
  }
  const estado = movimiento.estadoImputacion;
  const cls =
    estado === 'imputado'
      ? 'bg-green-100 text-green-800'
      : estado === 'imputado_parcial'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-vialto-mist text-vialto-steel';
  return <span className={`${badgeBase} ${cls}`}>{ESTADO_IMPUTACION_LABEL[estado] ?? estado}</span>;
}

type Props = {
  tipoContraparte: TipoContraparte;
  contraparteId: string;
  contraparteNombre: string;
};

export function CuentaContraparteView({
  tipoContraparte,
  contraparteId,
  contraparteNombre,
}: Props) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [movimientos, setMovimientos] = useState<MovimientoCc[] | null>(null);
  const [saldos, setSaldos] = useState<SaldoPorMoneda[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const cargarDatos = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const [movs, saldo] = await Promise.all([
        fetchMovimientos(
          () => getToken(),
          tipoContraparte === 'cliente' ? { clienteId: contraparteId } : { proveedorId: contraparteId },
        ),
        tipoContraparte === 'cliente'
          ? fetchSaldoCliente(() => getToken(), contraparteId)
          : fetchSaldoProveedor(() => getToken(), contraparteId),
      ]);
      setMovimientos(movs);
      setSaldos(saldo.saldos);
      setError(null);
    } catch (e) {
      setMovimientos(null);
      setSaldos(null);
      setError(friendlyError(e, 'cuentaCorriente'));
    }
  }, [getToken, isLoaded, isSignedIn, tipoContraparte, contraparteId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function pagosDisponiblesPara(cargo: MovimientoCc) {
    return (movimientos ?? []).filter(
      (m) => m.tipo === 'pago' && m.moneda === cargo.moneda && m.estadoImputacion !== 'imputado',
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
            {contraparteNombre}
          </h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {saldos && saldos.length > 0 ? (
              saldos.map((s) => (
                <span
                  key={s.moneda}
                  className={`font-medium ${s.saldo > 0.005 ? 'text-vialto-fire' : 'text-vialto-steel'}`}
                >
                  Saldo {s.moneda}: {formatCurrencyArFromNumber(s.saldo)}
                </span>
              ))
            ) : (
              <span className="text-vialto-steel">Sin movimientos todavía.</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModal({ kind: 'nuevo', tipoInicial: 'cargo' })}
            className="inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
          >
            Nuevo cargo
          </button>
          <button
            type="button"
            onClick={() => setModal({ kind: 'nuevo', tipoInicial: 'pago' })}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            {tipoContraparte === 'cliente' ? 'Registrar cobranza' : 'Registrar pago'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        columns={[
          {
            id: 'fecha',
            header: 'Fecha',
            primary: true,
            cell: (m: MovimientoCc) => new Date(m.fecha).toLocaleDateString('es-AR'),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'tipo',
            header: 'Tipo',
            cell: (m: MovimientoCc) => (m.tipo === 'cargo' ? 'Cargo' : 'Pago'),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'concepto',
            header: 'Concepto',
            cell: (m: MovimientoCc) => (
              <span>
                {m.concepto}
                {m.numeroComprobante ? (
                  <span className="block text-xs text-vialto-steel">{m.numeroComprobante}</span>
                ) : null}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'importe',
            header: 'Importe',
            cell: (m: MovimientoCc) => `${formatCurrencyArFromNumber(m.importe)} ${m.moneda}`,
            tdClassName: `${listadoTablaTdClass} tabular-nums`,
          },
          {
            id: 'vencimiento',
            header: 'Vencimiento',
            cell: (m: MovimientoCc) =>
              m.fechaVencimiento ? new Date(m.fechaVencimiento).toLocaleDateString('es-AR') : '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'estado',
            header: 'Estado',
            cell: (m: MovimientoCc) => <EstadoBadge movimiento={m} />,
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={error ? [] : movimientos}
        rowKey={(m) => m.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los movimientos.'
            : 'Todavía no hay movimientos para esta cuenta.'
        }
        loadingMessage="Cargando…"
        renderActions={(m: MovimientoCc) =>
          m.tipo === 'cargo' &&
          (m.estadoDisponibilidad === 'pendiente' || m.estadoDisponibilidad === 'parcial') ? (
            <button
              type="button"
              onClick={() => setModal({ kind: 'imputar', cargo: m })}
              className={listadoTablaAccionClass}
            >
              Imputar pago
            </button>
          ) : null
        }
      />

      {modal?.kind === 'nuevo' && (
        <MovimientoCcFormModal
          tipoContraparte={tipoContraparte}
          contraparteId={contraparteId}
          contraparteNombre={contraparteNombre}
          tipoInicial={modal.tipoInicial}
          onClose={() => setModal(null)}
          onCreated={cargarDatos}
        />
      )}
      {modal?.kind === 'imputar' && (
        <ImputarPagoModal
          cargo={modal.cargo}
          pagosDisponibles={pagosDisponiblesPara(modal.cargo)}
          onClose={() => setModal(null)}
          onDone={cargarDatos}
        />
      )}
    </div>
  );
}
