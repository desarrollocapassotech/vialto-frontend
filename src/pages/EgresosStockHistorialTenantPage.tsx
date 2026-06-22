import { useAuth } from '@clerk/clerk-react';
import { FileSpreadsheet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ExcelExportModal } from '@/components/stock/ExcelExportModal';
import { ImprimirRemitoButton } from '@/components/stock/ImprimirRemitoButton';
import { StockOperacionViewModal } from '@/components/stock/StockOperacionViewModal';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import {
  flattenStockOperaciones,
  stockOperacionColumnas,
} from '@/lib/stockExcelExport';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import type { StockOperacion } from '@/types/api';

function buildQsTenant(tenantId?: string): string {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
}

export function EgresosStockHistorialTenantPage({
  tenantId,
  embeddedInSuperadmin,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
}) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);
  const egresosUrl = platform
    ? `/api/platform/stock/egresos${buildQsTenant(tenantId)}`
    : '/api/stock/egresos';

  const [items, setItems] = useState<StockOperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<StockOperacion | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<StockOperacion[]>(egresosUrl, () => getToken());
      setItems(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    } finally {
      setLoading(false);
    }
  }, [egresosUrl, getToken]);

  useEffect(() => { void load(); }, [load]);

  const volverHref = platform
    ? `/stock/egresos?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/egresos';

  const excelCols = stockOperacionColumnas('egreso');
  const excelRows = flattenStockOperaciones(items);

  return (
    <div className="w-full space-y-6">
      {!embeddedInSuperadmin && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Historial de egresos</h1>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              disabled={excelRows.length === 0}
              className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider border border-black/20 px-3 py-2 hover:bg-vialto-mist disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
              Descargar Excel
            </button>
            <Link to={volverHref} className="text-sm font-medium text-vialto-fire hover:underline">
              ← Volver a egresos
            </Link>
          </div>
        </div>
      )}

      {embeddedInSuperadmin && (
        <div className="flex flex-wrap items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={excelRows.length === 0}
            className="text-xs font-medium uppercase tracking-wider border border-black/20 px-3 py-2 hover:bg-vialto-mist disabled:opacity-40"
          >
            Descargar Excel
          </button>
          <Link to={volverHref} className="text-sm font-medium text-vialto-fire hover:underline">
            ← Volver a egresos
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ListadoDatos
        className={!embeddedInSuperadmin ? 'mt-4' : ''}
        columns={[
          {
            id: 'fecha',
            header: 'Fecha',
            primary: true,
            cell: (op) => formatMovimientoStockFechaFromIso(op.fecha),
            tdClassName: `${listadoTablaTdClass} whitespace-nowrap`,
          },
          {
            id: 'remito',
            header: 'Remito',
            cell: (op) => op.numeroRemito ?? '—',
            tdClassName: `${listadoTablaTdClass} font-mono`,
          },
          {
            id: 'cliente',
            header: 'Cliente',
            cell: (op) => op.cliente?.nombre ?? op.clienteId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'deposito',
            header: 'Depósito',
            cell: (op) => op.deposito?.nombre ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'destinatario',
            header: 'Destinatario',
            cell: (op) => op.destinatario ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'productos',
            header: 'Productos',
            cell: (op) => {
              const count = op.movimientos.length;
              if (count === 1) {
                return op.movimientos[0].producto?.nombre ?? '1 producto';
              }
              return `${count} productos`;
            },
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={loading ? null : items}
        rowKey={(op) => op.id}
        emptyMessage="No hay egresos registrados."
        loadingMessage="Cargando…"
        renderActions={(op) => (
          <div className="flex flex-wrap justify-end gap-2">
            <ImprimirRemitoButton
              variant="listado"
              className={listadoTablaAccionClass}
              egresoId={op.id}
              tenantId={tenantId}
              titulo={op.numeroRemito ? `Remito ${op.numeroRemito}` : 'Remito interno'}
            />
            <button
              type="button"
              onClick={() => setViendo(op)}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
          </div>
        )}
        actionsTdClassName={`${listadoTablaTdClass} text-right whitespace-nowrap`}
      />

      {viendo && (
        <StockOperacionViewModal
          operacion={viendo}
          tenantId={tenantId}
          onClose={() => setViendo(null)}
        />
      )}

      {exportModalOpen && (
        <ExcelExportModal
          columns={excelCols}
          rowCount={excelRows.length}
          onExport={(selectedIds) => {
            const cols = excelCols.filter((c) => selectedIds.includes(c.id));
            void generarExcel(cols, excelRows, 'historial-egresos');
          }}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}

async function generarExcel<T>(
  cols: import('@/lib/stockExcelExport').ExcelColDef<T>[],
  rows: T[],
  filename: string,
) {
  const { generarExcel: gen } = await import('@/lib/stockExcelExport');
  return gen(cols, rows, filename);
}
