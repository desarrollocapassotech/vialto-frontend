import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
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

const TH =
  'px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-vialto-steel';
const TD = 'px-3 py-2.5 text-sm text-vialto-charcoal';

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
  return (
    <tr className="bg-vialto-mist/50">
      <td colSpan={colSpan} className="px-3 py-3 sm:px-4 sm:pl-12">
        <div className="overflow-hidden rounded-md border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/8 bg-vialto-mist/70 px-3 py-2 sm:px-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-vialto-steel">
              Detalle por lote · vencimiento y trazabilidad
            </p>
          </div>

          <div className="px-2 py-2 sm:px-3 sm:py-3">
            {loading && (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-vialto-steel">
                <Spinner className="h-4 w-4" />
                Cargando desglose por lote…
              </div>
            )}
            {error && (
              <p className="mx-1 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
            {!loading && !error && filas == null && (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-vialto-steel">
                <Spinner className="h-4 w-4" />
                Cargando desglose por lote…
              </div>
            )}
            {!loading && !error && filas && filas.length === 0 && (
              <p className="px-2 py-3 text-sm text-vialto-steel">
                Sin stock por lote para esta presentación.
              </p>
            )}
            {!loading && !error && filas && filas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse">
                  <thead>
                    <tr className="border-b border-black/8 text-left">
                      <th className={TH}>Lote</th>
                      <th className={TH}>Vencimiento</th>
                      <th className={`${TH} text-right`}>{unidad1Nombre}</th>
                      {showUnidad2 && (
                        <th className={`${TH} text-right`}>
                          {unidad2Nombre ?? 'Sueltos'}
                        </th>
                      )}
                      <th className={`${TH} text-right`}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((fila) => (
                      <tr
                        key={fila.key}
                        className="border-b border-black/5 last:border-b-0 hover:bg-vialto-mist/40"
                      >
                        <td className={`${TD} font-medium`}>{fila.loteLabel}</td>
                        <td className={TD}>
                          <FechaVencimientoLote
                            fechaVencimiento={fila.fechaVencimiento}
                          />
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          <span className="font-semibold">{fila.cantidad1}</span>
                        </td>
                        {showUnidad2 && (
                          <td className={`${TD} text-right tabular-nums`}>
                            {unidad2Nombre === null ? (
                              <span className="text-vialto-steel">—</span>
                            ) : (
                              <span className="font-semibold">{fila.cantidad2}</span>
                            )}
                          </td>
                        )}
                        <td className={`${TD} text-right`}>
                          <Link
                            to={buildMovimientosHref({
                              productoId,
                              clienteId,
                              depositoId,
                              loteParam: fila.loteParam,
                              tenantId,
                            })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs text-vialto-charcoal transition-colors hover:border-black/25 hover:bg-vialto-mist"
                          >
                            <ExternalLink
                              className="h-3 w-3 shrink-0 text-vialto-steel"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            Ver movimiento
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
