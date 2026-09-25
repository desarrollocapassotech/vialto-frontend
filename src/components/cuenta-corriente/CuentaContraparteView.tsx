import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoFiltroCampo } from '@/components/listado/ListadoFiltroCampo';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { AccionesOpcionesSheet } from '@/components/ui/AccionesOpcionesSheet';
import { listadoTablaAccionClass, listadoTablaHeadRowClass, listadoTablaThClass } from '@/lib/listadoTabla';

/**
 * Más compacto que `listadoTablaTdClass` (py-3) a propósito: el historial de una
 * cuenta suele tener decenas/cientos de filas — con el padding default del resto
 * de los listados quedaba con demasiado espacio en blanco entre fila y fila.
 */
const listadoTablaTdClass = 'px-3 py-1.5 text-vialto-charcoal md:px-4';
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
import { ExportarEstadoCuentaModal } from './ExportarEstadoCuentaModal';

type ModalState =
  | { kind: 'nuevo'; tipoInicial: TipoMovimientoCc }
  | { kind: 'imputar'; cargo: MovimientoCc }
  | { kind: 'exportar'; formato: 'pdf' | 'excel' }
  | null;

type MovimientoConSaldo = MovimientoCc & { saldoAcumulado: number };

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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

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

  // Saldo acumulado: se calcula acá (no lo trae el backend en este endpoint) recorriendo
  // los movimientos en orden cronológico. Un cargo anulado (viaje reabierto/factura
  // anulada) no suma, igual que en el cálculo de saldo del backend — ver Fase 3.
  const movimientosConSaldo = useMemo<MovimientoConSaldo[] | null>(() => {
    if (!movimientos) return null;
    const ascendente = [...movimientos].sort((a, b) => {
      const porFecha = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
      if (porFecha !== 0) return porFecha;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    let acumulado = 0;
    const saldoPorId = new Map<string, number>();
    for (const m of ascendente) {
      if (!(m.tipo === 'cargo' && m.estadoDisponibilidad === 'anulado')) {
        acumulado += m.tipo === 'cargo' ? m.importe : -m.importe;
      }
      saldoPorId.set(m.id, acumulado);
    }
    return movimientos.map((m) => ({ ...m, saldoAcumulado: saldoPorId.get(m.id) ?? 0 }));
  }, [movimientos]);

  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [desdeFiltro, setDesdeFiltro] = useState('');
  const [hastaFiltro, setHastaFiltro] = useState('');
  const [conceptoFiltro, setConceptoFiltro] = useState('');
  const [comprobanteFiltro, setComprobanteFiltro] = useState('');

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (estadoFiltro) n += 1;
    if (desdeFiltro || hastaFiltro) n += 1;
    if (conceptoFiltro.trim()) n += 1;
    if (comprobanteFiltro.trim()) n += 1;
    return n;
  }, [estadoFiltro, desdeFiltro, hastaFiltro, conceptoFiltro, comprobanteFiltro]);
  const anyFiltroActivo = activeFilterCount > 0;

  // Filtro solo de despliegue: se aplica sobre `movimientosConSaldo` (ya calculado con
  // TODO el historial) para que el saldo acumulado de cada fila siga siendo el real,
  // en vez de recalcularse desde cero con el subconjunto filtrado.
  const movimientosFiltrados = useMemo<MovimientoConSaldo[] | null>(() => {
    if (!movimientosConSaldo) return null;
    return movimientosConSaldo.filter((m) => {
      if (estadoFiltro) {
        const estadoActual = m.tipo === 'cargo' ? m.estadoDisponibilidad : m.estadoImputacion;
        if (estadoActual !== estadoFiltro) return false;
      }
      const fecha = m.fecha.slice(0, 10);
      if (desdeFiltro && fecha < desdeFiltro) return false;
      if (hastaFiltro && fecha > hastaFiltro) return false;
      if (conceptoFiltro.trim() && !m.concepto.toLowerCase().includes(conceptoFiltro.trim().toLowerCase()))
        return false;
      if (
        comprobanteFiltro.trim() &&
        !(m.numeroComprobante ?? '').toLowerCase().includes(comprobanteFiltro.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [movimientosConSaldo, estadoFiltro, desdeFiltro, hastaFiltro, conceptoFiltro, comprobanteFiltro]);

  function limpiarFiltros() {
    setEstadoFiltro('');
    setDesdeFiltro('');
    setHastaFiltro('');
    setConceptoFiltro('');
    setComprobanteFiltro('');
  }

  function pagosDisponiblesPara(cargo: MovimientoCc) {
    return (movimientos ?? []).filter(
      (m) => m.tipo === 'pago' && m.moneda === cargo.moneda && m.estadoImputacion !== 'imputado',
    );
  }

  const filtroInputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

  const estadoFiltroSelect = (
    <select
      value={estadoFiltro}
      onChange={(e) => setEstadoFiltro(e.target.value)}
      className={`${filtroInputClass} ${estadoFiltro ? 'text-vialto-fire' : 'text-vialto-charcoal'}`}
      aria-label="Filtrar por estado"
    >
      <option value="">Todos</option>
      <optgroup label={tipoContraparte === 'cliente' ? 'Ventas' : 'Compras'}>
        {Object.entries(ESTADO_DISPONIBILIDAD_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </optgroup>
      <optgroup label={tipoContraparte === 'cliente' ? 'Cobros' : 'Pagos'}>
        {Object.entries(ESTADO_IMPUTACION_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </optgroup>
    </select>
  );

  const fechaFiltroCampos = (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
        Desde
        <input
          type="date"
          value={desdeFiltro}
          onChange={(e) => setDesdeFiltro(e.target.value)}
          className={filtroInputClass}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
        Hasta
        <input
          type="date"
          value={hastaFiltro}
          onChange={(e) => setHastaFiltro(e.target.value)}
          className={filtroInputClass}
        />
      </label>
    </div>
  );

  const conceptoFiltroInput = (
    <input
      type="text"
      value={conceptoFiltro}
      onChange={(e) => setConceptoFiltro(e.target.value)}
      placeholder="Buscar…"
      className={`${filtroInputClass} ${conceptoFiltro.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'}`}
      aria-label="Filtrar por concepto"
    />
  );

  const comprobanteFiltroInput = (
    <input
      type="text"
      value={comprobanteFiltro}
      onChange={(e) => setComprobanteFiltro(e.target.value)}
      placeholder="Buscar…"
      className={`${filtroInputClass} ${comprobanteFiltro.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'}`}
      aria-label="Filtrar por comprobante"
    />
  );

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
            onClick={() => setExportMenuOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
          >
            Exportar
            <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
              <path
                d="M2.5 4.5 6 8l3.5-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setModal({ kind: 'nuevo', tipoInicial: 'cargo' })}
            className="inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
          >
            {tipoContraparte === 'cliente' ? 'Nueva venta' : 'Nueva compra'}
          </button>
          <button
            type="button"
            onClick={() => setModal({ kind: 'nuevo', tipoInicial: 'pago' })}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            {tipoContraparte === 'cliente' ? 'Registrar cobro' : 'Registrar pago'}
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
            cell: (m: MovimientoConSaldo) => new Date(m.fecha).toLocaleDateString('es-AR'),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'concepto',
            header: 'Concepto',
            cell: (m: MovimientoConSaldo) => (
              <span>
                {m.concepto}
                {m.fechaVencimiento && (
                  <span className="block text-xs text-vialto-steel">
                    vence {new Date(m.fechaVencimiento).toLocaleDateString('es-AR')}
                  </span>
                )}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
          ...(tipoContraparte === 'cliente'
            ? [
                {
                  id: 'numeroFactura',
                  header: 'Comprobante',
                  cell: (m: MovimientoConSaldo) => m.numeroComprobante ?? '—',
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
                },
              ]
            : []),
          {
            id: 'debe',
            header: 'Debe',
            cell: (m: MovimientoConSaldo) =>
              m.tipo === 'cargo' ? `${formatCurrencyArFromNumber(m.importe)} ${m.moneda}` : '—',
            tdClassName: `${listadoTablaTdClass} tabular-nums`,
          },
          {
            id: 'haber',
            header: 'Haber',
            cell: (m: MovimientoConSaldo) =>
              m.tipo === 'pago' ? `${formatCurrencyArFromNumber(m.importe)} ${m.moneda}` : '—',
            tdClassName: `${listadoTablaTdClass} tabular-nums`,
          },
          {
            id: 'saldo',
            header: 'Saldo',
            cell: (m: MovimientoConSaldo) =>
              m.pendiente != null && m.pendiente > 0.005
                ? `${formatCurrencyArFromNumber(m.pendiente)} ${m.moneda}`
                : '—',
            tdClassName: `${listadoTablaTdClass} tabular-nums text-vialto-steel`,
          },
          {
            id: 'saldoAcumulado',
            header: 'Saldo acumulado',
            cell: (m: MovimientoConSaldo) => `${formatCurrencyArFromNumber(m.saldoAcumulado)} ${m.moneda}`,
            tdClassName: `${listadoTablaTdClass} tabular-nums font-medium`,
          },
          {
            id: 'estado',
            header: 'Estado',
            cell: (m: MovimientoConSaldo) => <EstadoBadge movimiento={m} />,
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={error ? [] : movimientosFiltrados}
        rowKey={(m) => m.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los movimientos.'
            : anyFiltroActivo
              ? 'No hay movimientos que coincidan con los filtros aplicados.'
              : 'Todavía no hay movimientos para esta cuenta.'
        }
        loadingMessage="Cargando…"
        activeFilterCount={activeFilterCount}
        onClearFilters={limpiarFiltros}
        filters={
          <>
            <ListadoFiltroCampo label="Fecha" active={!!desdeFiltro || !!hastaFiltro}>
              {fechaFiltroCampos}
            </ListadoFiltroCampo>
            <ListadoFiltroCampo label="Concepto" active={!!conceptoFiltro.trim()}>
              {conceptoFiltroInput}
            </ListadoFiltroCampo>
            {tipoContraparte === 'cliente' && (
              <ListadoFiltroCampo label="Comprobante" active={!!comprobanteFiltro.trim()}>
                {comprobanteFiltroInput}
              </ListadoFiltroCampo>
            )}
            <ListadoFiltroCampo label="Estado" active={!!estadoFiltro}>
              {estadoFiltroSelect}
            </ListadoFiltroCampo>
          </>
        }
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Fecha"
                filterActive={!!desdeFiltro || !!hastaFiltro}
                filterSignature={`${desdeFiltro}|${hastaFiltro}`}
              >
                {fechaFiltroCampos}
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Concepto"
                filterActive={!!conceptoFiltro.trim()}
                filterSignature={conceptoFiltro}
              >
                {conceptoFiltroInput}
              </ViajesListadoHeaderFiltro>
            </th>
            {tipoContraparte === 'cliente' && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Comprobante"
                  filterActive={!!comprobanteFiltro.trim()}
                  filterSignature={comprobanteFiltro}
                >
                  {comprobanteFiltroInput}
                </ViajesListadoHeaderFiltro>
              </th>
            )}
            <th scope="col" className={listadoTablaThClass}>
              Debe
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Haber
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Saldo
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Saldo acumulado
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Estado"
                filterActive={!!estadoFiltro}
                filterSignature={estadoFiltro}
              >
                {estadoFiltroSelect}
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        tableColSpan={tipoContraparte === 'cliente' ? 9 : 8}
        renderActions={(m: MovimientoConSaldo) =>
          m.tipo === 'cargo' &&
          (m.estadoDisponibilidad === 'pendiente' || m.estadoDisponibilidad === 'parcial') ? (
            <button
              type="button"
              onClick={() => setModal({ kind: 'imputar', cargo: m })}
              className={listadoTablaAccionClass}
            >
              {m.clienteId ? 'Imputar cobro' : 'Imputar pago'}
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
      {modal?.kind === 'exportar' && (
        <ExportarEstadoCuentaModal
          tipoContraparte={tipoContraparte}
          contraparteId={contraparteId}
          contraparteNombre={contraparteNombre}
          formato={modal.formato}
          onClose={() => setModal(null)}
        />
      )}

      <AccionesOpcionesSheet
        open={exportMenuOpen}
        onClose={() => setExportMenuOpen(false)}
        title="Exportar estado de cuenta"
        options={[
          {
            id: 'pdf',
            label: 'Exportar PDF',
            icon: FileText,
            onClick: () => setModal({ kind: 'exportar', formato: 'pdf' }),
          },
          {
            id: 'excel',
            label: 'Exportar Excel',
            icon: FileSpreadsheet,
            onClick: () => setModal({ kind: 'exportar', formato: 'excel' }),
          },
        ]}
      />
    </div>
  );
}
