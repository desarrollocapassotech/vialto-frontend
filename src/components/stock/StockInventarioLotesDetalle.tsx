import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import {
  compareLotesFefo,
  nivelVencimientoLote,
  STOCK_SIN_LOTE_VALUE,
  type LoteDisponible,
  type LotesDisponiblesResponse,
} from '@/lib/stockLote';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';

export type StockInventarioLoteFila = {
  key: string;
  loteLabel: string;
  loteParam: string;
  cantidad1: number;
  cantidad2: number;
  fechaVencimiento: string | null;
};

export function filasDesdeLotesResponse(
  data: LotesDisponiblesResponse,
): StockInventarioLoteFila[] {
  const filas: StockInventarioLoteFila[] = [...data.lotes]
    .sort(compareLotesFefo)
    .map((l: LoteDisponible) => ({
      key: l.lote,
      loteLabel: l.lote,
      loteParam: l.lote,
      cantidad1: l.cantidad1,
      cantidad2: l.cantidad2,
      fechaVencimiento: l.fechaVencimiento,
    }));

  if (data.sinLote && (data.sinLote.cantidad1 > 0 || data.sinLote.cantidad2 > 0)) {
    filas.push({
      key: STOCK_SIN_LOTE_VALUE,
      loteLabel: 'Sin lote',
      loteParam: STOCK_SIN_LOTE_VALUE,
      cantidad1: data.sinLote.cantidad1,
      cantidad2: data.sinLote.cantidad2,
      fechaVencimiento: null,
    });
  }

  return filas;
}

function buildMovimientosHref(opts: {
  productoId: string;
  clienteId: string;
  depositoId: string;
  loteParam: string;
  tenantId?: string;
}): string {
  const params = new URLSearchParams();
  params.set('productoId', opts.productoId);
  params.set('clienteId', opts.clienteId);
  params.set('depositoId', opts.depositoId);
  params.set('lote', opts.loteParam);
  if (opts.tenantId?.trim()) params.set('tenantId', opts.tenantId.trim());
  return `/stock/movimientos?${params.toString()}`;
}

/** Sub-fila de lote: fondo apenas más oscuro que la fila del producto. */
const SUBFILA = 'bg-vialto-mist/40';
const TD = 'h-8 px-3 py-1 text-sm text-vialto-charcoal';
/** Primera celda (bajo el chevron): línea que marca que el lote cuelga del producto de arriba. */
const TD_VACIA = 'border-l-2 border-l-vialto-charcoal/25';

/** Fecha de vencimiento + indicador visual de urgencia. */
export function FechaVencimientoLote({
  fechaVencimiento,
}: {
  fechaVencimiento: string | null;
}) {
  if (!fechaVencimiento) {
    return <span className="text-vialto-steel">—</span>;
  }

  const fecha = formatMovimientoStockFechaFromIso(fechaVencimiento);
  const nivel = nivelVencimientoLote(fechaVencimiento);

  if (nivel === 'vencido') {
    return (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <CircleAlert
          className="h-3.5 w-3.5 shrink-0 text-red-600"
          strokeWidth={2}
          aria-hidden
        />
        <span className="text-red-800">{fecha}</span>
        <span className="sr-only">Vencido</span>
      </span>
    );
  }

  if (nivel === 'proximo') {
    return (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <AlertTriangle
          className="h-3.5 w-3.5 shrink-0 text-amber-600"
          strokeWidth={2}
          aria-hidden
        />
        <span className="text-amber-950" title="Vence dentro de los próximos 30 días">
          {fecha}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-vialto-charcoal">
      <CheckCircle2
        className="h-3.5 w-3.5 shrink-0 text-emerald-600"
        strokeWidth={2}
        aria-hidden
      />
      <span>{fecha}</span>
    </span>
  );
}

/**
 * Aviso en la fila del Inventario, sin desplegarla: ícono rojo si algún lote con saldo está
 * vencido, ámbar si vence en los próximos 30 días. Nada si está todo en fecha o no hay lotes.
 */
export function AvisoVencimientoFila({
  proximoVencimiento,
}: {
  proximoVencimiento: string | null | undefined;
}) {
  const nivel = nivelVencimientoLote(proximoVencimiento);
  if (nivel !== 'vencido' && nivel !== 'proximo') return null;
  const fecha = formatMovimientoStockFechaFromIso(proximoVencimiento, { soloFecha: true });
  const texto =
    nivel === 'vencido' ? `Tiene un lote vencido (${fecha})` : `Un lote vence el ${fecha}`;
  const Icono = nivel === 'vencido' ? CircleAlert : AlertTriangle;
  return (
    <span className="inline-flex shrink-0" title={texto} aria-label={texto}>
      <Icono
        className={`h-4 w-4 ${nivel === 'vencido' ? 'text-red-600' : 'text-amber-600'}`}
        strokeWidth={2}
        aria-hidden
      />
    </span>
  );
}

export function StockInventarioLotesDetalle({
  colSpan,
  showUnidad2,
  unidad1Nombre,
  unidad2Nombre,
  loading,
  error,
  filas,
  productoId,
  clienteId,
  depositoId,
  tenantId,
}: {
  colSpan: number;
  showUnidad2: boolean;
  unidad1Nombre: string;
  unidad2Nombre: string | null;
  loading: boolean;
  error: string | null;
  filas: StockInventarioLoteFila[] | null;
  productoId: string;
  clienteId: string;
  depositoId: string;
  tenantId?: string;
}) {
  const navigate = useNavigate();

  // Estados sin filas: un solo renglón liviano debajo de la fila del producto.
  const mensaje =
    loading || (!error && filas == null) ? (
      <span className="inline-flex items-center gap-2 text-vialto-steel">
        <Spinner className="h-3.5 w-3.5" />
        Cargando lotes…
      </span>
    ) : error ? (
      <span className="text-red-700">{error}</span>
    ) : filas && filas.length === 0 ? (
      <span className="text-vialto-steel">Sin stock por lote para esta presentación.</span>
    ) : null;

  if (mensaje) {
    return (
      <tr className={SUBFILA}>
        <td className={TD_VACIA} />
        <td colSpan={colSpan - 1} className={`${TD} pl-6 text-xs`}>
          {mensaje}
        </td>
      </tr>
    );
  }

  // Una sub-fila por lote, alineada con las columnas de la tabla:
  // [chevron] [lote + vencimiento (cliente+producto)] [stock total] [kg] [sueltos] [acciones].
  // Click en la sub-fila = única acción "Ver movimientos" del lote.
  return (
    <>
      {filas!.map((fila) => (
        <tr
          key={fila.key}
          className={`${SUBFILA} cursor-pointer hover:bg-vialto-mist`}
          title="Ver movimientos de este lote"
          onClick={() =>
            navigate(
              buildMovimientosHref({
                productoId,
                clienteId,
                depositoId,
                loteParam: fila.loteParam,
                tenantId,
              }),
            )
          }
        >
          <td className={TD_VACIA} />
          <td colSpan={2} className={`${TD} pl-6`}>
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <span>
                <span className="text-xs text-vialto-steel">Lote </span>
                <span className="font-medium">{fila.loteLabel}</span>
              </span>
              <span className="text-xs">
                <span className="text-vialto-steel">Vto. </span>
                <FechaVencimientoLote fechaVencimiento={fila.fechaVencimiento} />
              </span>
            </span>
          </td>
          <td className={`${TD} text-right tabular-nums`}>
            <span className="font-medium">{fila.cantidad1}</span>{' '}
            <span className="text-xs text-vialto-steel">{unidad1Nombre}</span>
          </td>
          <td className={TD} />
          {showUnidad2 && (
            <td className={`${TD} text-right tabular-nums`}>
              {unidad2Nombre === null ? (
                <span className="text-vialto-steel">—</span>
              ) : (
                <span className="font-medium">{fila.cantidad2}</span>
              )}
            </td>
          )}
          <td className={TD} />
        </tr>
      ))}
    </>
  );
}
