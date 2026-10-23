import { fechaDiaYmd, fmtDateUtc } from "@/lib/fmtDateUtc";
import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote,
  CircleCheck,
  CircleDashed,
  Eye,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
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
import { ImputacionesCobroModal } from './ImputacionesCobroModal';
import { ImputacionesCargoModal, imputacionesDeCargo } from './ImputacionesCargoModal';
import {
  EliminarMovimientoDialog,
  MovimientoCcDetalleModal,
  cantidadImputacionesCc,
  movimientoCcEliminable,
  nombreMovimientoCc,
} from './MovimientoCcDetalleModal';
import { DeshacerImputacionDialog } from './DeshacerImputacionButton';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import {
  canAccessEmisionLiquidoProductoArca,
  comprasNacenDeLiquidaciones,
  ventasNacenDeFacturas,
} from '@/lib/tenantModules';
import { ExportarEstadoCuentaModal } from './ExportarEstadoCuentaModal';
import { LimpiarFiltrosPortal } from "@/components/listado/LimpiarFiltrosButton";
import { FiltrosRapidos, type FiltroRapidoOpcion } from '@/components/listado/FiltrosRapidos';
import { hoyArgentinaIso } from '@/lib/facturaFechaEmision';
import { TruncarInicio } from '@/components/ui/TruncarInicio';
import { ComprobanteAdjuntoClip } from '@/components/shared/ComprobanteAdjuntoClip';
import { abrirAdjuntoEnPestana } from '@/lib/abrirAdjunto';
import { useAbrirAdjunto } from '@/hooks/useAbrirAdjunto';
import { verPdfFacturaArca } from '@/lib/facturaPdfArca';
import { verPdfLiquidacion } from '@/lib/liquidacionContratoPdf';

type ModalState =
  | { kind: 'nuevo'; tipoInicial: TipoMovimientoCc }
  | { kind: 'imputar'; cargo: MovimientoCc }
  | { kind: 'comprobante'; movimiento: MovimientoCc }
  | { kind: 'origen'; comprobante: ComprobanteOrigenCc }
  | { kind: 'imputaciones'; pago: MovimientoCc }
  | { kind: 'imputacionesCargo'; cargo: MovimientoCc }
  | { kind: 'detalle'; movimiento: MovimientoCc }
  | { kind: 'deshacerImputacion'; imputacionId: string; descripcion: string }
  | { kind: 'eliminar'; movimiento: MovimientoCc }
  | { kind: 'exportar'; formato: 'pdf' | 'excel' }
  | null;

type MovimientoConSaldo = MovimientoCc & {
  saldoAcumulado: number;
  /** Saldo de CADA moneda después de este movimiento (las que no se movieron arrastran el último). */
  saldosAcumulados: Record<string, number>;
  /** Cobro/pago imputado a un solo cargo: ese cargo (su factura/liquidación). */
  cargoUnico: MovimientoCc | null;
  /** Columna Comprobante: el número propio del movimiento (en un cobro/pago, el del recibo/orden de pago). */
  comprobanteMostrado: string | null;
  /** Cobro/pago imputado: el número de cada factura/liquidación que cancela (tooltip y filtro). */
  comprobantesImputados: string[];
};

/** Saldo con signo pesos adelante: "$ 1.234,00" / "-$ 1.234,00". */
function fmtSaldo(valor: number): string {
  return valor < 0
    ? `-$ ${formatCurrencyArFromNumber(-valor)}`
    : `$ ${formatCurrencyArFromNumber(valor)}`;
}

/**
 * Ícono sutil junto al número de una venta/compra imputada (tooltip con el detalle):
 * tilde verde = imputada por completo, círculo punteado ámbar = en parte (le queda saldo).
 * Sale de `estadoDisponibilidad`, que recalcula el backend.
 */
function EtiquetaImputacionCargo({ m }: { m: MovimientoCc }) {
  if (m.tipo !== 'cargo') return null;
  const estado =
    m.estadoDisponibilidad === 'cancelado'
      ? { Icono: CircleCheck, clase: 'text-emerald-600', titulo: 'Imputada por completo' }
      : m.estadoDisponibilidad === 'parcial'
        ? { Icono: CircleDashed, clase: 'text-amber-600', titulo: 'Imputada en parte: le queda saldo' }
        : null;
  if (!estado) return null;
  const { Icono, clase, titulo } = estado;
  return (
    <span className={`inline-flex shrink-0 cursor-help ${clase}`} title={titulo} aria-label={titulo}>
      <Icono className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </span>
  );
}

/**
 * Título de columna sin embudo con la misma altura que uno con embudo
 * (`ViajesListadoHeaderFiltro`: botón h-[26px]), así todos quedan en la misma línea cuando
 * el encabezado tiene dos filas y las celdas van `align-top`.
 */
function TituloSinFiltro({ children, alignRight }: { children: ReactNode; alignRight?: boolean }) {
  return (
    <span className={`flex min-h-[26px] items-center ${alignRight ? 'justify-end' : ''}`}>
      {children}
    </span>
  );
}

/** Subtítulo del menú de acciones de una fila: tipo + número de comprobante ("COBRO 3132132"). */
function subtituloAcciones(m: MovimientoCc): string {
  const numero = m.numeroComprobante?.trim();
  return numero ? `${m.concepto} ${numero}` : m.concepto;
}

/**
 * Filtro rápido "Sin imputar": venta/compra con saldo pendiente o cobro/pago con algo sin
 * imputar. Lo anulado y los créditos de anulación no cuentan.
 */
function estaSinImputar(m: MovimientoCc): boolean {
  if (m.tipo === 'credito' || m.estadoDisponibilidad === 'anulado') return false;
  if (m.tipo !== 'cargo' && m.tipo !== 'pago') return false;
  return (m.pendiente ?? 0) > 0.005;
}

type FiltroRapidoCc = 'sin_imputar' | 'vencidos' | 'sin_cobrar';

/** Filtro rápido "Sin cobrar" / "Sin pagar": venta/compra no anulada con saldo pendiente. */
function estaSinCobrar(m: MovimientoCc): boolean {
  return m.tipo === 'cargo' && m.estadoDisponibilidad !== 'anulado' && (m.pendiente ?? 0) > 0.005;
}

/** Filtro rápido "Vencidos": sin cobrar/pagar y con vencimiento anterior a hoy (día en Argentina). */
function estaVencido(m: MovimientoCc, hoy: string): boolean {
  const vto = fechaDiaYmd(m.fechaVencimiento);
  return estaSinCobrar(m) && !!vto && vto < hoy;
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
  /** Misma fila que el selector y los saldos: Exportar / Nueva venta / Registrar cobro. */
  accionesSlot?: HTMLElement | null;
  /** Junto al título de la página: ahí va "Limpiar filtros" (regla global). */
  limpiarFiltrosSlot?: HTMLElement | null;
  /** Junto al título: embudo + chips de filtro rápido ("Sin imputar"), como en Viajes. */
  filtrosRapidosSlot?: HTMLElement | null;
};

export function CuentaContraparteView({
  tipoContraparte,
  contraparteId,
  contraparteNombre,
  saldosSlot,
  accionesSlot,
  limpiarFiltrosSlot,
  filtrosRapidosSlot,
}: Props) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { abrirAdjunto, visorAdjunto } = useAbrirAdjunto();
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
  const hasArcaLiquidaciones = canAccessEmisionLiquidoProductoArca(modulos);
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
      // Cobro/pago imputado: los números de lo que cancela (solo tooltip y filtro; la
      // columna muestra el comprobante del cobro/pago).
      const comprobantesImputados =
        m.tipo === 'pago'
          ? (m.cargosImputadosIds ?? []).map(
              (id) => porId.get(id)?.numeroComprobante?.trim() || 'Sin número',
            )
          : [];
      conSaldo.push({
        ...m,
        saldoAcumulado: acumulado,
        saldosAcumulados: Object.fromEntries(acumuladoPorMoneda),
        cargoUnico,
        comprobantesImputados,
        comprobanteMostrado: m.numeroComprobante?.trim() || null,
      });
    }
    return conSaldo.reverse();
  }, [movimientos]);

  const [desdeFiltro, setDesdeFiltro] = useState('');
  const [hastaFiltro, setHastaFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [comprobanteFiltro, setComprobanteFiltro] = useState('');
  // Se elige tocando la tarjeta de saldo de esa moneda (solo si la cuenta tiene más de una).
  const [monedaFiltro, setMonedaFiltro] = useState('');
  const multimoneda = (saldos?.length ?? 0) > 1;
  // Filtros rápidos junto al título (mismo componente que Viajes/Facturas/Liquidaciones),
  // excluyentes entre sí.
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapidoCc | ''>('');
  const cantidadesFiltroRapido = useMemo(() => {
    const hoy = hoyArgentinaIso();
    const lista = movimientosConSaldo ?? [];
    return {
      sin_imputar: lista.filter(estaSinImputar).length,
      vencidos: lista.filter((m) => estaVencido(m, hoy)).length,
      sin_cobrar: lista.filter(estaSinCobrar).length,
    };
  }, [movimientosConSaldo]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (desdeFiltro || hastaFiltro) n += 1;
    if (tipoFiltro.trim()) n += 1;
    if (comprobanteFiltro.trim()) n += 1;
    if (monedaFiltro) n += 1;
    if (filtroRapido) n += 1;
    return n;
  }, [desdeFiltro, hastaFiltro, tipoFiltro, comprobanteFiltro, monedaFiltro, filtroRapido]);
  const anyFiltroActivo = activeFilterCount > 0;

  // Filtro solo de despliegue: se aplica sobre `movimientosConSaldo` (ya calculado con
  // TODO el historial) para que el saldo acumulado de cada fila siga siendo el real,
  // en vez de recalcularse desde cero con el subconjunto filtrado.
  const movimientosFiltrados = useMemo<MovimientoConSaldo[] | null>(() => {
    if (!movimientosConSaldo) return null;
    const hoy = hoyArgentinaIso();
    return movimientosConSaldo.filter((m) => {
      if (filtroRapido === 'sin_imputar' && !estaSinImputar(m)) return false;
      if (filtroRapido === 'vencidos' && !estaVencido(m, hoy)) return false;
      if (filtroRapido === 'sin_cobrar' && !estaSinCobrar(m)) return false;
      if (monedaFiltro && m.moneda !== monedaFiltro) return false;
      const fecha = fechaDiaYmd(m.fecha) ?? '';
      if (desdeFiltro && fecha < desdeFiltro) return false;
      if (hastaFiltro && fecha > hastaFiltro) return false;
      if (tipoFiltro && m.concepto !== tipoFiltro) return false;
      if (
        comprobanteFiltro.trim() &&
        ![m.comprobanteMostrado ?? '', ...m.comprobantesImputados].some((n) =>
          n.toLowerCase().includes(comprobanteFiltro.trim().toLowerCase()),
        )
      )
        return false;
      return true;
    });
  }, [movimientosConSaldo, monedaFiltro, desdeFiltro, hastaFiltro, tipoFiltro, comprobanteFiltro, filtroRapido]);

  function limpiarFiltros() {
    setFiltroRapido('');
    setMonedaFiltro('');
    setDesdeFiltro('');
    setHastaFiltro('');
    setTipoFiltro('');
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
    return base ? origenDeCargo(base) : null;
  }

  /** La factura/liquidación de un cargo, si la empresa tiene el módulo para abrirla. */
  function origenDeCargo(c: MovimientoCc): ComprobanteOrigenCc | null {
    if (c.facturaId && puedeVerFacturas) return { tipo: 'factura', id: c.facturaId };
    if (c.liquidacionId && puedeVerLiquidaciones) return { tipo: 'liquidacion', id: c.liquidacionId };
    return null;
  }

  /**
   * Clips de la columna Comprobante, mismo criterio y colores que las grillas de Facturas y
   * Liquidaciones: gris = comprobante (adjunto o PDF de ARCA), azul = PDF de liquidación
   * (sin ARCA), rojo = anulación. Un cargo muestra los suyos; una anulación, el de la
   * anulación del cargo que compensa. Los cobros/pagos no llevan clip.
   */
  function clipsDe(m: MovimientoConSaldo): ReactNode {
    const tk = () => getToken();
    const adjunto = (url: string | null | undefined, titulo: string) => {
      const u = url?.trim();
      return u ? () => abrirAdjunto({ url: u }, titulo) : undefined;
    };
    const pdfLiq = (id: string, kind: 'pdf' | 'pdf-anulacion', titulo: string) => () =>
      void abrirAdjuntoEnPestana(
        { apiPath: `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}/${kind}` },
        tk,
        titulo,
      );
    const pdfFactura = (id: string, kind: 'factura' | 'nc') => () =>
      void verPdfFacturaArca(id, kind, tk).catch(() => undefined);

    if (m.tipo === 'credito' && m.anulaMovimientoId) {
      const anulado = (movimientos ?? []).find((x) => x.id === m.anulaMovimientoId);
      const f = anulado?.facturaComprobantes;
      const l = anulado?.liquidacionComprobantes;
      let abrir: (() => void) | undefined;
      let titulo = 'Ver comprobante de anulación';
      if (anulado?.facturaId && f) {
        titulo = 'Ver nota de crédito';
        abrir = f.anulacionCae
          ? pdfFactura(anulado.facturaId, 'nc')
          : adjunto(f.notaCreditoUrl, 'Nota de crédito');
      } else if (anulado?.liquidacionId && l) {
        abrir =
          l.anulacionMetodo === 'manual'
            ? adjunto(l.anulacionManualComprobanteUrl, 'Comprobante de anulación')
            : l.anulacionCae
              ? pdfLiq(anulado.liquidacionId, 'pdf-anulacion', 'Anulación')
              : undefined;
      }
      return abrir ? <ComprobanteAdjuntoClip onClick={abrir} tono="anulacion" titulo={titulo} /> : null;
    }

    if (m.tipo !== 'cargo') return null;
    const clips: ReactNode[] = [];
    const f = m.facturaComprobantes;
    const l = m.liquidacionComprobantes;
    if (m.facturaId && f) {
      const abrir = f.cae ? pdfFactura(m.facturaId, 'factura') : adjunto(f.comprobanteUrl, 'Comprobante');
      if (abrir) clips.push(<ComprobanteAdjuntoClip key="cbte" onClick={abrir} />);
    } else if (m.liquidacionId && l) {
      const abrir =
        l.cbteNro != null
          ? pdfLiq(m.liquidacionId, 'pdf', 'Liquidación')
          : adjunto(l.comprobanteUrl, 'Comprobante');
      if (abrir) clips.push(<ComprobanteAdjuntoClip key="cbte" onClick={abrir} />);
      if (!hasArcaLiquidaciones && l.cbteNro == null) {
        const liqId = m.liquidacionId;
        clips.push(
          <ComprobanteAdjuntoClip
            key="pdf"
            onClick={() => void verPdfLiquidacion(liqId, tk)}
            tono="pdf"
            titulo="PDF de liquidación"
          />,
        );
      }
    }
    return clips.length ? <>{clips}</> : null;
  }

  /** Acciones de una fila: las usan el botón de Acciones y el click en la fila. */
  function accionesDe(m: MovimientoConSaldo): AccionOpcion[] {
    const opciones: AccionOpcion[] = [];
    // "Ver venta/compra/cobro/pago" siempre primero: detalle completo, y la edición
    // (comprobante, fechas, importes) se hace desde ahí, ya no hay un botón suelto de
    // "Editar comprobante".
    if (m.tipo === 'cargo' || m.tipo === 'pago') {
      opciones.push({
        id: 'ver-detalle',
        label: `Ver ${nombreMovimientoCc(m)}`,
        icon: Eye,
        onClick: () => setModal({ kind: 'detalle', movimiento: m }),
      });
    }
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
    // Venta/compra con cobros/pagos imputados: ver cuáles y cuánto aplicó cada uno.
    if (m.tipo === 'cargo' && imputacionesDeCargo(m, movimientos ?? []).length > 0) {
      opciones.push({
        id: 'ver-imputacion',
        label: 'Ver imputación',
        icon: History,
        onClick: () => setModal({ kind: 'imputacionesCargo', cargo: m }),
      });
    }
    // Deshacer imputación desde la fila: con una sola, confirma y la deshace ahí; con
    // varias, abre "Ver …" (cada imputación tiene su botón Deshacer).
    const imputacionesFila =
      m.tipo === 'cargo'
        ? imputacionesDeCargo(m, movimientos ?? []).map((i) => ({
            imputacionId: i.imputacionId,
            importe: i.importe,
            otro: i.pago as MovimientoCc | null,
          }))
        : m.tipo === 'pago'
          ? (m.imputacionesPorCargo ?? []).map((i) => ({
              imputacionId: i.imputacionId,
              importe: i.importe,
              otro: (movimientos ?? []).find((x) => x.id === i.cargoId) ?? null,
            }))
          : [];
    if (imputacionesFila.length > 0) {
      opciones.push({
        id: 'deshacer-imputacion',
        label: imputacionesFila.length === 1 ? 'Deshacer imputación' : 'Deshacer imputaciones',
        icon: Undo2,
        onClick: () => {
          if (imputacionesFila.length > 1) {
            setModal({ kind: 'detalle', movimiento: m });
            return;
          }
          const { imputacionId, importe, otro } = imputacionesFila[0];
          setModal({
            kind: 'deshacerImputacion',
            imputacionId,
            descripcion: `$ ${formatCurrencyArFromNumber(importe)} ${m.moneda} ${
              m.tipo === 'cargo' ? 'del' : 'a'
            } ${otro ? nombreMovimientoCc(otro) : 'comprobante'} ${
              otro?.numeroComprobante?.trim() || 'sin comprobante'
            }`,
          });
        },
      });
    }
    // Eliminar toda venta/compra/cobro/pago manual no anulado, aunque esté imputado: el
    // backend deshace sus imputaciones antes de borrarlo.
    if (movimientoCcEliminable(m)) {
      opciones.push({
        id: 'eliminar',
        label: `Eliminar ${nombreMovimientoCc(m)}`,
        icon: Trash2,
        onClick: () => setModal({ kind: 'eliminar', movimiento: m }),
      });
    }
    const origen = comprobanteOrigenDe(m);
    // Cobros/pagos y anulaciones: "Ver facturas asociadas" (una → su detalle; varias →
    // cuánto fue a cada una). Una factura/liquidación: "Ver factura/liquidación".
    const esAsociada = m.tipo === 'pago' || m.tipo === 'credito';
    const asociadasLabel = m.clienteId ? 'Ver facturas asociadas' : 'Ver liquidaciones asociadas';
    if (esAsociada && m.tipo === 'pago' && (m.imputacionesPorCargo?.length ?? 0) > 1) {
      opciones.push({
        id: 'ver-asociadas',
        label: asociadasLabel,
        icon: FileSearch,
        onClick: () => setModal({ kind: 'imputaciones', pago: m }),
      });
    } else if (origen) {
      opciones.push({
        id: esAsociada ? 'ver-asociadas' : 'ver-origen',
        label: esAsociada
          ? asociadasLabel
          : origen.tipo === 'factura'
            ? 'Ver factura'
            : 'Ver liquidación',
        icon: esAsociada ? FileSearch : FileText,
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

  // Opciones: los tipos (conceptos) que hay en esta cuenta, sin repetir.
  const tiposDisponibles = useMemo(
    () => [...new Set((movimientos ?? []).map((m) => m.concepto))].sort((a, b) => a.localeCompare(b, 'es')),
    [movimientos],
  );

  const tipoFiltroInput = (
    <select
      value={tipoFiltro}
      onChange={(e) => setTipoFiltro(e.target.value)}
      className={`${filtroInputClass} ${tipoFiltro ? 'text-vialto-fire' : 'text-vialto-charcoal'}`}
      aria-label="Filtrar por tipo"
    >
      <option value="">Todos</option>
      {tiposDisponibles.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
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

  // Opciones: las monedas que hay en esta cuenta.
  const monedasDisponibles = useMemo(
    () => [...new Set((movimientos ?? []).map((m) => m.moneda))].sort(),
    [movimientos],
  );
  // Cuenta con pesos y dólares (y sin filtrar por una moneda): "Saldo acumulado" se parte en
  // una subcolumna por moneda (ARS / USD), con el encabezado en dos filas.
  const saldoMultimoneda = monedasDisponibles.length > 1 && !monedaFiltro;
  const filasHead = saldoMultimoneda ? 2 : 1;

  const monedaFiltroInput = (
    <select
      value={monedaFiltro}
      onChange={(e) => setMonedaFiltro(e.target.value)}
      className={`${filtroInputClass} ${monedaFiltro ? 'text-vialto-fire' : 'text-vialto-charcoal'}`}
      aria-label="Filtrar por moneda"
    >
      <option value="">Todas</option>
      {monedasDisponibles.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
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

  const accionesNode = (
    <div className="ml-auto flex flex-wrap gap-2">
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
        className="inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
      >
        {tipoContraparte === 'cliente' ? 'Registrar cobro' : 'Registrar pago'}
      </button>
    </div>
  );

  return (
    <div>
      {visorAdjunto}
      {saldosSlot ? createPortal(saldosNode, saldosSlot) : null}
      {accionesSlot ? createPortal(accionesNode, accionesSlot) : null}
      {/* Filtro rápido junto al título, igual que Viajes. */}
      {filtrosRapidosSlot &&
        createPortal(
          <FiltrosRapidos
            opciones={[
              { id: 'sin_imputar', label: 'Sin imputar', count: cantidadesFiltroRapido.sin_imputar },
              { id: 'vencidos', label: 'Vencidos', count: cantidadesFiltroRapido.vencidos },
              {
                id: 'sin_cobrar',
                label: tipoContraparte === 'cliente' ? 'Sin cobrar' : 'Sin pagar',
                count: cantidadesFiltroRapido.sin_cobrar,
              },
            ] satisfies FiltroRapidoOpcion<FiltroRapidoCc>[]}
            value={filtroRapido}
            onChange={setFiltroRapido}
            ariaLabel="Filtros rápidos de cuenta corriente"
          />,
          filtrosRapidosSlot,
        )}
      <LimpiarFiltrosPortal
        slot={limpiarFiltrosSlot}
        visible={anyFiltroActivo}
        onClick={limpiarFiltros}
        soloDesktop
      />
      {(!saldosSlot || !accionesSlot) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {!saldosSlot && saldosNode}
          {!accionesSlot && accionesNode}
        </div>
      )}

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
            id: 'tipo',
            header: 'Tipo',
            cell: (m: MovimientoConSaldo) => <span>{m.concepto}</span>,
            tdClassName: listadoTablaTdClass,
          },
          // Número de factura o liquidación (o de la nota de crédito/débito en una anulación).
          {
            id: 'numeroFactura',
            header: 'Comprobante',
            cell: (m: MovimientoConSaldo) => (
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {/* Número largo: se trunca por el principio (se ven los últimos caracteres,
                    "…0000127"), como las columnas de ID; el número completo va en el tooltip.
                    En un cobro/pago el tooltip suma a qué facturas/liquidaciones se imputó. */}
                <TruncarInicio
                  className={`max-w-[11rem] ${m.comprobantesImputados.length > 0 ? 'cursor-help' : ''}`}
                  title={
                    [
                      m.comprobanteMostrado ?? '',
                      m.comprobantesImputados.length > 0
                        ? `Imputado a:\n${m.comprobantesImputados.join('\n')}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join('\n\n') || undefined
                  }
                >
                  {m.comprobanteMostrado ?? '—'}
                </TruncarInicio>
                <EtiquetaImputacionCargo m={m} />
                {clipsDe(m)}
              </span>
            ),
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
          // Una moneda: "Saldo acumulado". Varias (y sin filtrar por moneda): una subcolumna
          // por moneda bajo "Saldo acumulado", nunca sumadas; resalta la moneda de la fila.
          ...(saldoMultimoneda
            ? monedasDisponibles.map((moneda) => ({
                id: `saldoAcumulado-${moneda}`,
                header: `Saldo ${moneda}`,
                cell: (m: MovimientoConSaldo) => (
                  <span className={m.moneda === moneda ? 'font-medium' : 'text-vialto-steel'}>
                    {m.saldosAcumulados[moneda] != null ? fmtSaldo(m.saldosAcumulados[moneda]) : '—'}
                  </span>
                ),
                tdClassName: `${listadoTablaTdClass} tabular-nums`,
              }))
            : [
                {
                  id: 'saldoAcumulado',
                  header: 'Saldo acumulado',
                  cell: (m: MovimientoConSaldo) => `${fmtSaldo(m.saldoAcumulado)} ${m.moneda}`,
                  tdClassName: `${listadoTablaTdClass} tabular-nums font-medium`,
                },
              ]),
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
            <ListadoFiltroCampo label="Tipo" active={!!tipoFiltro.trim()}>
              {tipoFiltroInput}
            </ListadoFiltroCampo>
            <ListadoFiltroCampo label="Comprobante" active={!!comprobanteFiltro.trim()}>
              {comprobanteFiltroInput}
            </ListadoFiltroCampo>
            <ListadoFiltroCampo label="Moneda" active={!!monedaFiltro}>
              {monedaFiltroInput}
            </ListadoFiltroCampo>
          </>
        }
        tableHead={
          <>
          {/* Con pesos y dólares el encabezado tiene 2 filas ("Saldo acumulado" arriba, ARS/USD
              abajo). Para que todos los títulos queden en la misma línea: todas las celdas de la
              primera fila van `align-top`, y los títulos sin embudo usan `TituloSinFiltro`, con la
              misma altura que el botón del embudo. */}
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" rowSpan={filasHead} className={`${listadoTablaThClass} align-top`}>
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
            <th scope="col" rowSpan={filasHead} className={`${listadoTablaThClass} align-top`}>
              <TituloSinFiltro>Vencimiento</TituloSinFiltro>
            </th>
            <th scope="col" rowSpan={filasHead} className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Tipo"
                filterActive={!!tipoFiltro.trim()}
                filterSignature={tipoFiltro}
                onClear={() => setTipoFiltro('')}
              >
                {tipoFiltroInput}
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" rowSpan={filasHead} className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Comprobante"
                filterActive={!!comprobanteFiltro.trim()}
                filterSignature={comprobanteFiltro}
                onClear={() => setComprobanteFiltro('')}
              >
                {comprobanteFiltroInput}
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" rowSpan={filasHead} className={`${listadoTablaThClass} align-top`}>
              <TituloSinFiltro>Debe</TituloSinFiltro>
            </th>
            <th scope="col" rowSpan={filasHead} className={`${listadoTablaThClass} align-top`}>
              <TituloSinFiltro>Haber</TituloSinFiltro>
            </th>
            <th scope="col" rowSpan={filasHead} className={`${listadoTablaThClass} align-top`}>
              <TituloSinFiltro>Saldo</TituloSinFiltro>
            </th>
            {/* "Saldo acumulado" ocupa una subcolumna por moneda (con varias). El embudo de
                moneda es el mismo filtro que las tarjetas de saldo. */}
            <th
              scope={saldoMultimoneda ? 'colgroup' : 'col'}
              colSpan={saldoMultimoneda ? monedasDisponibles.length : 1}
              className={`${listadoTablaThClass} align-top`}
            >
              <ViajesListadoHeaderFiltro
                title="Saldo acumulado"
                filterActive={!!monedaFiltro}
                filterSignature={monedaFiltro}
                onClear={() => setMonedaFiltro('')}
              >
                {monedaFiltroInput}
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" rowSpan={filasHead} className={`${listadoTablaThClass} align-top text-right`}>
              <TituloSinFiltro alignRight>Acciones</TituloSinFiltro>
            </th>
          </tr>
          {saldoMultimoneda && (
            <tr className={listadoTablaHeadRowClass}>
              {monedasDisponibles.map((moneda) => (
                <th key={moneda} scope="col" className={`${listadoTablaThClass} pt-0`}>
                  {moneda}
                </th>
              ))}
            </tr>
          )}
          </>
        }
        tableColSpan={8 + (saldoMultimoneda ? monedasDisponibles.length : 1)}
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
              subtitle={subtituloAcciones(m)}
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
          cargosPendientes={(movimientos ?? []).filter(
            (m) =>
              m.tipo === 'cargo' &&
              (m.estadoDisponibilidad === 'pendiente' || m.estadoDisponibilidad === 'parcial') &&
              (m.pendiente ?? m.importe) > 0.005,
          )}
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
      {modal?.kind === 'imputaciones' && (
        <ImputacionesCobroModal
          pago={modal.pago}
          movimientos={movimientos ?? []}
          onVerCargo={(cargo) => {
            const origen = origenDeCargo(cargo);
            return origen ? () => setModal({ kind: 'origen', comprobante: origen }) : null;
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'detalle' && (
        <MovimientoCcDetalleModal
          // Al saltar de un comprobante a su asociado, el modal arranca de cero (sin la edición del anterior).
          key={modal.movimiento.id}
          movimiento={modal.movimiento}
          movimientos={movimientos ?? []}
          onClose={() => setModal(null)}
          onSaved={cargarDatos}
          // Factura/liquidación: su edición de siempre (número y vencimiento).
          onEditarAutomatico={
            modal.movimiento.origen !== 'manual' &&
            (modal.movimiento.comprobanteEditable || modal.movimiento.vencimientoEditable)
              ? () => setModal({ kind: 'comprobante', movimiento: modal.movimiento })
              : null
          }
          onVerMovimiento={(otro) => setModal({ kind: 'detalle', movimiento: otro })}
        />
      )}
      {modal?.kind === 'eliminar' && (
        <EliminarMovimientoDialog
          movimiento={modal.movimiento}
          cantidadImputaciones={cantidadImputacionesCc(modal.movimiento, movimientos ?? [])}
          onCancel={() => setModal(null)}
          onEliminado={() => {
            setModal(null);
            void cargarDatos();
          }}
        />
      )}
      {modal?.kind === 'deshacerImputacion' && (
        <DeshacerImputacionDialog
          imputacionId={modal.imputacionId}
          descripcion={modal.descripcion}
          onCancel={() => setModal(null)}
          onDeshecha={() => {
            setModal(null);
            void cargarDatos();
          }}
        />
      )}
      {modal?.kind === 'imputacionesCargo' && (
        <ImputacionesCargoModal
          cargo={modal.cargo}
          movimientos={movimientos ?? []}
          onVerMovimiento={(otro) => setModal({ kind: 'detalle', movimiento: otro })}
          onDeshecha={() => {
            setModal(null);
            void cargarDatos();
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'origen' && (
        <ComprobanteOrigenCcModal
          comprobante={modal.comprobante}
          contraparteNombre={contraparteNombre}
          hasArcaLiquidaciones={hasArcaLiquidaciones}
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
        subtitle={accionesDeFila ? subtituloAcciones(accionesDeFila) : undefined}
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
