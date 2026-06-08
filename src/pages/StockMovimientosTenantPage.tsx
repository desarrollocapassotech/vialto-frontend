import { useAuth } from '@clerk/clerk-react';
import { FileSpreadsheet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ExcelExportModal } from '@/components/stock/ExcelExportModal';
import { MovimientoStockViewModal } from '@/components/stock/MovimientoStockViewModal';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import { generarExcel, movimientoStockColumnas } from '@/lib/stockExcelExport';
import {
  movimientoStockTipoBadgeClass,
  movimientoStockTipoLabel,
  movimientoStockTipoNumeroClass,
} from '@/lib/stockMovimientoTipo';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import type { MovimientoStock } from '@/types/api';

function buildQs(params: Record<string, string>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params)) parts.push(`${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function StockMovimientosTenantPage({ tenantId }: { tenantId?: string }) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);
  const movimientosUrl = platform
    ? `/api/platform/stock/movimientos${buildQs({ soloIngresoEgreso: 'true' }, tenantId)}`
    : '/api/stock/movimientos?soloIngresoEgreso=true';

  const [items, setItems] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalleMovimientoId, setDetalleMovimientoId] = useState<string | null>(null);
  const [detalleMovimientoTipo, setDetalleMovimientoTipo] = useState<MovimientoStock['tipo'] | undefined>();
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<MovimientoStock[]>(movimientosUrl, () => getToken());
      setItems(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    } finally {
      setLoading(false);
    }
  }, [movimientosUrl, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full space-y-6">
      {!platform && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-vialto-charcoal">Movimientos</h1>
            <p className="mt-1 text-sm text-vialto-steel">
              Ingresos y egresos al depósito, ordenados por fecha de movimiento (más reciente primero).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider border border-black/20 px-3 py-2 hover:bg-vialto-mist disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            Descargar Excel
          </button>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <ListadoDatos
        className={!platform ? 'mt-4' : ''}
        columns={[
          {
            id: 'fecha',
            header: 'Fecha',
            primary: true,
            cell: (m) => formatMovimientoStockFechaFromIso(m.fecha),
            tdClassName: `${listadoTablaTdClass} whitespace-nowrap`,
          },
          {
            id: 'tipo',
            header: 'Tipo',
            cell: (m) => (
              <span className={movimientoStockTipoBadgeClass(m.tipo)}>
                {movimientoStockTipoLabel(m.tipo)}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'remito',
            header: 'Remito',
            cell: (m) => m.numeroRemito ?? '—',
            tdClassName: `${listadoTablaTdClass} font-mono`,
          },
          {
            id: 'producto',
            header: 'Producto',
            cell: (m) => m.producto?.nombre ?? m.productoId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'cliente',
            header: 'Cliente',
            cell: (m) => m.cliente?.nombre ?? m.clienteId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'deposito',
            header: 'Depósito',
            cell: (m) => m.deposito?.nombre ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'cant1',
            header: 'Cant. 1',
            cell: (m) => (
              <>
                <span className={movimientoStockTipoNumeroClass(m.tipo)}>{m.cantidad1}</span>
                {' '}
                <span className="text-xs text-vialto-steel">{m.producto?.unidad1Nombre ?? 'Pallets'}</span>
              </>
            ),
            tdClassName: `${listadoTablaTdClass} text-right`,
          },
          {
            id: 'cant2',
            header: 'Cant. 2',
            cell: (m) =>
              m.producto?.unidad2Nombre !== null ? (
                <>
                  <span className={movimientoStockTipoNumeroClass(m.tipo)}>{m.cantidad2}</span>
                  {' '}
                  <span className="text-xs text-vialto-steel">{m.producto?.unidad2Nombre ?? 'Unidad'}</span>
                </>
              ) : (
                '—'
              ),
            tdClassName: `${listadoTablaTdClass} text-right`,
          },
        ]}
        rows={loading ? null : items}
        rowKey={(m) => m.id}
        emptyMessage="No hay movimientos para mostrar."
        loadingMessage="Cargando…"
        renderActions={(m) => (
          <button
            type="button"
            onClick={() => {
              setDetalleMovimientoId(m.id);
              setDetalleMovimientoTipo(m.tipo);
            }}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
        actionsTdClassName={`${listadoTablaTdClass} text-right whitespace-nowrap`}
      />

      {detalleMovimientoId && (
        <MovimientoStockViewModal
          movimientoId={detalleMovimientoId}
          tenantId={tenantId}
          tipoTitulo={detalleMovimientoTipo}
          onClose={() => {
            setDetalleMovimientoId(null);
            setDetalleMovimientoTipo(undefined);
          }}
        />
      )}

      {exportModalOpen && (
        <ExcelExportModal
          columns={movimientoStockColumnas(items)}
          rowCount={items.length}
          onExport={(selectedIds) => {
            const allCols = movimientoStockColumnas(items);
            const cols = allCols.filter((c) => selectedIds.includes(c.id));
            generarExcel(cols, items, 'movimientos-stock');
          }}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}
