import { fechaDiaYmd, fmtDateUtc } from "@/lib/fmtDateUtc";
import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, Eye, FileSpreadsheet, FileText, Filter, Hash, X } from 'lucide-react';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoFiltroCampo } from '@/components/listado/ListadoFiltroCampo';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { AccionesFila } from '@/components/ui/AccionesFila';
import { AccionesOpcionesSheet, type AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';
import { listadoTablaHeadRowClass, listadoTablaThClass } from '@/lib/listadoTabla';

/**
 * Más compacto que `listadoTablaTdClass` (py-3) a propósito: el historial de una
 * cuenta suele tener decenas/cientos de filas — con el padding default del resto
 * de los listados quedaba con demasiado espacio en blanco entre fila y fila.
 */
const listadoTablaTdClass = 'h-8 px-3 py-1 text-vialto-charcoal md:px-4';
import { formatCurrencyArFromNumber } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import {
  fetchMovimientos,
  fetchSaldoCliente,
  fetchSaldoProveedor,
  cuentaEnHistorialCc,
  esDebeCc,
  type MovimientoCc,
  type SaldoPorMoneda,
  type TipoContraparte,
  type TipoMovimientoCc,
} from '@/lib/cuentaCorriente';
import { MovimientoCcFormModal } from './MovimientoCcFormModal';
import { ImputarPagoModal } from './ImputarPagoModal';
import { ComprobanteCcModal } from './ComprobanteCcModal';
import { ComprobanteOrigenCcModal, type ComprobanteOrigenCc } from './ComprobanteOrigenCcModal';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import {
  canAccessEmisionLiquidoProductoArca,
  comprasNacenDeLiquidaciones,
  ventasNacenDeFacturas,
} from '@/lib/tenantModules';
import { ExportarEstadoCuentaModal } from './ExportarEstadoCuentaModal';
import { LimpiarFiltrosPortal } from "@/components/listado/LimpiarFiltrosButton";

type ModalState =
  | { kind: 'nuevo'; tipoInicial: TipoMovimientoCc }
  | { kind: 'imputar'; cargo: MovimientoCc }
  | { kind: 'comprobante'; movimiento: MovimientoCc }
  | { kind: 'origen'; comprobante: ComprobanteOrigenCc }
  | { kind: 'exportar'; formato: 'pdf' | 'excel' }
  | null;

type MovimientoConSaldo = MovimientoCc & {
  saldoAcumulado: number;
  /** Cobro/pago imputado a un solo cargo: ese cargo (su factura/liquidación). */
  cargoUnico: MovimientoCc | null;
  /** Columna Comprobante: en un cobro de una sola factura, el número de esa factura. */
  comprobanteMostrado: string | null;
};

/** Saldo con signo pesos adelante: "$ 1.234,00" / "-$ 1.234,00". */
function fmtSaldo(valor: number): string {
  return valor < 0
    ? `-$ ${formatCurrencyArFromNumber(-valor)}`
    : `$ ${formatCurrencyArFromNumber(valor)}`;
}

/** Orden de carga ascendente; `id` desempata movimientos creados en el mismo instante. */
function compararPorCarga(a: MovimientoCc, b: MovimientoCc): number {
  const porCarga = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (porCarga !== 0) return porCarga;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

type Props = {
  tipoContraparte: TipoContraparte;
  contraparteId: string;
  contraparteNombre: string;
  /**
   * Lugar de la página donde dibujar las tarjetas de saldo (en la fila del selector de
   * cuenta, para aprovechar el espacio). Sin él, van arriba de la grilla.
   */
  saldosSlot?: HTMLElement | null;
  /** Junto al título de la página: ahí va "Limpiar filtros" (regla global). */
  limpiarFiltrosSlot?: HTMLElement | null;
};

export function CuentaContraparteView({
  tipoContraparte,
  contraparteId,
  contraparteNombre,
  saldosSlot,
  limpiarFiltrosSlot,
}: Props) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { tenant } = useCurrentTenant();
  // Venta/compra manual solo si la empresa no tiene el módulo que la genera (con
  // Facturación las ventas salen de las facturas; con Liquidaciones, las compras de las
  // liquidaciones). Hasta saber los módulos no se ofrece, para no mostrarla de más.
  const modulos = tenant?.modules ?? [];
  const permiteCargoManual =
    tenant != null &&
    (tipoContraparte === 'cliente'
      ? !ventasNacenDeFacturas(modulos)
      : !comprasNacenDeLiquidaciones(modulos));
  // "Ver factura/liquidación" solo si la empresa tiene el módulo (si no, no puede abrirla).
  const puedeVerFacturas = ventasNacenDeFacturas(modulos);
  const puedeVerLiquidaciones = comprasNacenDeLiquidaciones(modulos);
  const [movimientos, setMovimientos] = useState<MovimientoCc[] | null>(null);
  const [saldos, setSaldos] = useState<SaldoPorMoneda[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [accionesDeFila, setAccionesDeFila] = useState<MovimientoConSaldo | null>(null);

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

  // Orden de carga (`createdAt`), no `fecha`: un cobro recién registrado aparece primero
  // aunque su fecha sea anterior a otros movimientos (mismo criterio que Viajes). El saldo
  // acumulado se calcula acá (no lo trae el backend en este endpoint) recorriendo ese mismo
  // orden, para que cada fila sea coherente con lo que se ve. Un movimiento anulado suma
  // junto con su crédito de anulación en el Haber (el par se cancela, VTO-431); un anulado sin crédito no suma.
  // Se acumula por moneda (nunca se mezclan pesos con dólares), así cada fila muestra el
  // saldo de su moneda y el filtro por moneda sigue siendo coherente.
  const movimientosConSaldo = useMemo<MovimientoConSaldo[] | null>(() => {
    if (!movimientos) return null;
    const ascendente = [...movimientos].sort(compararPorCarga);
    const acumuladoPorMoneda = new Map<string, number>();
    const porId = new Map(movimientos.map((m) => [m.id, m]));
    const conSaldo: MovimientoConSaldo[] = [];
    for (const m of ascendente) {
      let acumulado = acumuladoPorMoneda.get(m.moneda) ?? 0;
      if (cuentaEnHistorialCc(m)) {
        acumulado += esDebeCc(m) ? m.importe : -m.importe;
        acumuladoPorMoneda.set(m.moneda, acumulado);
      }
      // Cobro/pago imputado a un único cargo: es "el cobro de esa factura/liquidación".
      const cargoUnico =
        m.tipo === 'pago' && m.cargosImputadosIds?.length === 1
          ? porId.get(m.cargosImputadosIds[0]) ?? null
          : null;
      conSaldo.push({
        ...m,
        saldoAcumulado: acumulado,
        cargoUnico,
        comprobanteMostrado: cargoUnico?.numeroComprobante ?? m.numeroComprobante ?? null,
      });
    }
    return conSaldo.reverse();
  }, [movimientos]);

  const [desdeFiltro, setDesdeFiltro] = useState('');
  const [hastaFiltro, setHastaFiltro] = useState('');
  const [conceptoFiltro, setConceptoFiltro] = useState('');
  const [comprobanteFiltro, setComprobanteFiltro] = useState('');
  // Se elige tocando la tarjeta de saldo de esa moneda (solo si la cuenta tiene más de una).
  const [monedaFiltro, setMonedaFiltro] = useState('');
  const multimoneda = (saldos?.length ?? 0) > 1;

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (desdeFiltro || hastaFiltro) n += 1;
    if (conceptoFiltro.trim()) n += 1;
    if (comprobanteFiltro.trim()) n += 1;
    if (monedaFiltro) n += 1;
    return n;
  }, [desdeFiltro, hastaFiltro, conceptoFiltro, comprobanteFiltro, monedaFiltro]);
  const anyFiltroActivo = activeFilterCount > 0;

  // Filtro solo de despliegue: se aplica sobre `movimientosConSaldo` (ya calculado con
  // TODO el historial) para que el saldo acumulado de cada fila siga siendo el real,
  // en vez de recalcularse desde cero con el subconjunto filtrado.
  const movimientosFiltrados = useMemo<MovimientoConSaldo[] | null>(() => {
    if (!movimientosConSaldo) return null;
    return movimientosConSaldo.filter((m) => {
      if (monedaFiltro && m.moneda !== monedaFiltro) return false;
      const fecha = fechaDiaYmd(m.fecha) ?? '';
      if (desdeFiltro && fecha < desdeFiltro) return false;
      if (hastaFiltro && fecha > hastaFiltro) return false;
      if (conceptoFiltro.trim() && !m.concepto.toLowerCase().includes(conceptoFiltro.trim().toLowerCase()))
        return false;
      if (
        comprobanteFiltro.trim() &&
        !(m.comprobanteMostrado ?? '').toLowerCase().includes(comprobanteFiltro.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [movimientosConSaldo, monedaFiltro, desdeFiltro, hastaFiltro, conceptoFiltro, comprobanteFiltro]);

  function limpiarFiltros() {
    setMonedaFiltro('');
    setDesdeFiltro('');
    setHastaFiltro('');
    setConceptoFiltro('');
    setComprobanteFiltro('');
  }

  /**
   * Factura o liquidación de la que nace el movimiento. Una anulación no guarda el vínculo:
   * se toma del movimiento que compensa (misma cuenta, ya está en la lista).
   */
  function comprobanteOrigenDe(m: MovimientoConSaldo): ComprobanteOrigenCc | null {
    // Anulación → el comprobante que compensa; cobro/pago de un solo cargo → ese cargo.
    const base = m.anulaMovimientoId
      ? (movimientos ?? []).find((x) => x.id === m.anulaMovimientoId) ?? null
      : m.tipo === 'pago'
        ? m.cargoUnico
        : m;
    if (!base) return null;
    if (base.facturaId && puedeVerFacturas) return { tipo: 'factura', id: base.facturaId };
    if (base.liquidacionId && puedeVerLiquidaciones) {
      return { tipo: 'liquidacion', id: base.liquidacionId };
    }
    return null;
  }

  /** Acciones de una fila: las usan el botón de Acciones y el click en la fila. */
  function accionesDe(m: MovimientoConSaldo): AccionOpcion[] {
    const opciones: AccionOpcion[] = [];
    const puedeImputar =
      m.tipo === 'cargo' &&
      (m.estadoDisponibilidad === 'pendiente' || m.estadoDisponibilidad === 'parcial');
    if (puedeImputar) {
      opciones.push({
        id: 'imputar',
        label: m.clienteId ? 'Imputar cobro' : 'Imputar pago',
        icon: Banknote,
        onClick: () => setModal({ kind: 'imputar', cargo: m }),
      });
    }
    if (m.comprobanteEditable || m.vencimientoEditable) {
      opciones.push({
        id: 'comprobante',
        // Con ARCA el número no se toca: la acción queda solo para el vencimiento.
        label: !m.comprobanteEditable
          ? 'Editar vencimiento'
          : m.numeroComprobante
            ? 'Editar comprobante'
            : 'Cargar comprobante',
        icon: Hash,
        onClick: () => setModal({ kind: 'comprobante', movimiento: m }),
      });
    }
    const origen = comprobanteOrigenDe(m);
    if (origen) {
      opciones.push({
        id: 'ver-origen',
        label: origen.tipo === 'factura' ? 'Ver factura' : 'Ver liquidación',
        icon: Eye,
        onClick: () => setModal({ kind: 'origen', comprobante: origen }),
      });
    }
    return opciones;
  }

  function pagosDisponiblesPara(cargo: MovimientoCc) {
    return (movimientos ?? []).filter(
      (m) => m.tipo === 'pago' && m.moneda === cargo.moneda && m.estadoImputacion !== 'imputado',
    );
  }

  const filtroInputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

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

  // Una tarjeta chica por moneda. Con más de una moneda, tocarla filtra la grilla.
  const saldosNode =
    saldos && saldos.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {saldos.map((s) => {
          const activa = monedaFiltro === s.moneda;
          const monto = (
            <span
              className={`font-[family-name:var(--font-display)] text-lg tracking-wide tabular-nums ${
                s.saldo > 0.005 ? 'text-vialto-bright' : 'text-white'
              }`}
            >
              {fmtSaldo(s.saldo)}
            </span>
          );
          // Mismo alto que el select de la cuenta (h-9), alineadas abajo con él.
          const cardClass = `flex h-9 min-w-[9.5rem] items-center px-3 text-left ${
            activa ? 'bg-vialto-charcoal ring-2 ring-vialto-fire' : 'bg-vialto-graphite'
          }`;
          return (
            <div key={s.moneda} className="flex flex-col">
              <span className="mb-1 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-vialto-steel">
                Saldo {s.moneda}
              </span>
              {/* Con una sola moneda no hay nada que filtrar: la tarjeta es solo informativa. */}
              {multimoneda ? (
                <button
                  type="button"
                  onClick={() => setMonedaFiltro(activa ? '' : s.moneda)}
                  aria-pressed={activa}
                  title={activa ? 'Ver todas las monedas' : `Ver solo movimientos en ${s.moneda}`}
                  className={`${cardClass} group cursor-pointer justify-between gap-3 transition hover:brightness-110`}
                >
                  {monto}
                  {/* Pista de que filtra: embudo; activa, una ✕ para volver a todas. */}
                  {activa ? (
                    <X className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
                  ) : (
                    <Filter
                      className="h-3.5 w-3.5 shrink-0 text-white/50 transition group-hover:text-white"
                      aria-hidden
                    />
                  )}
                </button>
              ) : (
                <div className={cardClass}>{monto}</div>
              )}
            </div>
          );
        })}
      </div>
    ) : saldos ? (
      <p className="text-sm text-vialto-steel">Sin movimientos todavía.</p>
    ) : null;

  return (
    <div>
      {saldosSlot ? createPortal(saldosNode, saldosSlot) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {!saldosSlot && saldosNode}
          <LimpiarFiltrosPortal
            slot={limpiarFiltrosSlot}
            visible={anyFiltroActivo}
            onClick={limpiarFiltros}
            soloDesktop
          />
        </div>
        <div className="ml-auto flex gap-2">
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
          {permiteCargoManual && (
            <button
              type="button"
              onClick={() => setModal({ kind: 'nuevo', tipoInicial: 'cargo' })}
              className="inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
            >
              {tipoContraparte === 'cliente' ? 'Nueva venta' : 'Nueva compra'}
            </button>
          )}
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
            cell: (m: MovimientoConSaldo) => fmtDateUtc(m.fecha),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'vencimiento',
            header: 'Vencimiento',
            cell: (m: MovimientoConSaldo) =>
              m.fechaVencimiento && m.estadoDisponibilidad !== 'anulado'
                ? fmtDateUtc(m.fechaVencimiento)
                : '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'concepto',
            header: 'Concepto',
            cell: (m: MovimientoConSaldo) => (
              <span>
                {m.concepto}
                {m.ivaPct != null && m.importeNeto != null && m.ivaMonto != null && (
                  <span className="block text-xs text-vialto-steel tabular-nums">
                    {formatCurrencyArFromNumber(m.importeNeto)} + IVA{' '}
                    {String(m.ivaPct).replace('.', ',')}% {formatCurrencyArFromNumber(m.ivaMonto)}
                  </span>
                )}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
          // Número de factura o liquidación (o de la nota de crédito/débito en una anulación).
          {
            id: 'numeroFactura',
            header: 'Comprobante',
            cell: (m: MovimientoConSaldo) => m.comprobanteMostrado ?? '—',
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: 'debe',
            header: 'Debe',
            cell: (m: MovimientoConSaldo) =>
              esDebeCc(m) ? `${formatCurrencyArFromNumber(m.importe)} ${m.moneda}` : '—',
            tdClassName: `${listadoTablaTdClass} tabular-nums`,
          },
          {
            id: 'haber',
            header: 'Haber',
            // Cobros/pagos y créditos de anulación (nota de crédito) van al Haber.
            cell: (m: MovimientoConSaldo) =>
              !esDebeCc(m) ? `${formatCurrencyArFromNumber(m.importe)} ${m.moneda}` : '—',
            tdClassName: `${listadoTablaTdClass} tabular-nums`,
          },
          {
            id: 'saldo',
            header: 'Saldo',
            cell: (m: MovimientoConSaldo) =>
              m.pendiente != null && m.pendiente > 0.005
                ? `${fmtSaldo(m.pendiente)} ${m.moneda}`
                : '—',
            tdClassName: `${listadoTablaTdClass} tabular-nums text-vialto-steel`,
          },
          {
            id: 'saldoAcumulado',
            header: 'Saldo acumulado',
            cell: (m: MovimientoConSaldo) => `${fmtSaldo(m.saldoAcumulado)} ${m.moneda}`,
            tdClassName: `${listadoTablaTdClass} tabular-nums font-medium`,
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
            <ListadoFiltroCampo label="Comprobante" active={!!comprobanteFiltro.trim()}>
              {comprobanteFiltroInput}
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
                onClear={() => {
                  setDesdeFiltro('');
                  setHastaFiltro('');
                }}
              >
                {fechaFiltroCampos}
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Vencimiento
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Concepto"
                filterActive={!!conceptoFiltro.trim()}
                filterSignature={conceptoFiltro}
                onClear={() => setConceptoFiltro('')}
              >
                {conceptoFiltroInput}
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Comprobante"
                filterActive={!!comprobanteFiltro.trim()}
                filterSignature={comprobanteFiltro}
                onClear={() => setComprobanteFiltro('')}
              >
                {comprobanteFiltroInput}
              </ViajesListadoHeaderFiltro>
            </th>
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
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        tableColSpan={9}
        // Sin padding vertical: los botones (h-8) ya dan el alto, así una fila con acciones
        // no queda más alta que una sin acciones.
        actionsTdClassName="px-3 py-0 text-right align-middle md:px-4"
        // Click en la fila: con una sola acción la ejecuta directo; con varias, abre el menú.
        onRowClick={(m: MovimientoConSaldo) => {
          const acciones = accionesDe(m);
          if (acciones.length === 1) acciones[0].onClick();
          else if (acciones.length > 1) setAccionesDeFila(m);
        }}
        renderActions={(m: MovimientoConSaldo) => {
          const opciones = accionesDe(m);
          if (opciones.length === 0) return null;
          return (
            <AccionesFila
              options={opciones}
              destacadas={opciones.map((o) => o.id)}
              subtitle={m.concepto}
            />
          );
        }}
      />

      {modal?.kind === 'nuevo' && (
        <MovimientoCcFormModal
          tipoContraparte={tipoContraparte}
          contraparteId={contraparteId}
          contraparteNombre={contraparteNombre}
          tipoInicial={modal.tipoInicial}
          permiteCargo={permiteCargoManual}
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
      {modal?.kind === 'comprobante' && (
        <ComprobanteCcModal
          movimiento={modal.movimiento}
          onClose={() => setModal(null)}
          onDone={cargarDatos}
        />
      )}
      {modal?.kind === 'origen' && (
        <ComprobanteOrigenCcModal
          comprobante={modal.comprobante}
          contraparteNombre={contraparteNombre}
          hasArcaLiquidaciones={canAccessEmisionLiquidoProductoArca(modulos)}
          onClose={() => setModal(null)}
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
        open={accionesDeFila != null}
        onClose={() => setAccionesDeFila(null)}
        title="Acciones"
        subtitle={accionesDeFila?.concepto}
        options={accionesDeFila ? accionesDe(accionesDeFila) : []}
      />

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
