import { useState } from 'react';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { ImprimirRemitoButton } from '@/components/stock/ImprimirRemitoButton';
import { ViewModalShell, viewModalBtnGhost } from '@/components/ui/ViewModalShell';
import { formatInstantEsAr24h, formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import type { StockOperacion } from '@/types/api';

const DT =
  'text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide';
const TD = 'py-2 px-3 text-sm text-vialto-charcoal';
const TH = 'py-2 px-3 text-left text-xs font-[family-name:var(--font-ui)] uppercase tracking-wider text-vialto-steel';

function Campo({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
      <dt className={DT}>{label}</dt>
      <dd className={`sm:col-span-2 text-vialto-charcoal${mono ? ' font-mono' : ''}`}>
        {value ?? '—'}
      </dd>
    </div>
  );
}

export function StockOperacionViewModal({
  operacion,
  tenantId,
  onClose,
}: {
  operacion: StockOperacion;
  tenantId?: string;
  onClose: () => void;
}) {
  const [previewFotoIdx, setPreviewFotoIdx] = useState<number | null>(null);
  const fotosUrls = operacion.tipo === 'ingreso' ? (operacion.fotosUrls ?? []) : [];

  const titulo =
    operacion.tipo === 'ingreso'
      ? 'Ingreso al depósito'
      : operacion.numeroRemito
        ? `Egreso — Remito ${operacion.numeroRemito}`
        : 'Egreso de stock';

  return (
    <ViewModalShell
      title={titulo}
      onClose={onClose}
      onOverlayClick={onClose}
      scrollBody
      maxWidthClass="sm:max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {operacion.tipo === 'egreso' && (
            <ImprimirRemitoButton
              egresoId={operacion.id}
              tenantId={tenantId}
              titulo={
                operacion.numeroRemito
                  ? `Remito ${operacion.numeroRemito}`
                  : 'Remito interno'
              }
            />
          )}
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
        </div>
      }
    >
      {/* â”€â”€ Cabecera â”€â”€ */}
      <dl className="divide-y divide-black/5 text-sm">
        <Campo
          label="Fecha"
          value={formatMovimientoStockFechaFromIso(operacion.fecha, { alwaysShowTime: true })}
        />
        <Campo label="Cliente" value={operacion.cliente?.nombre ?? operacion.clienteId} />
        <Campo label="Depósito" value={operacion.deposito?.nombre ?? operacion.depositoId} />

        {operacion.tipo === 'egreso' && operacion.numeroRemito && (
          <Campo label="N° Remito" value={operacion.numeroRemito} mono />
        )}

        {operacion.tipo === 'egreso' && (
          <>
            <Campo label="Conductor" value={operacion.entregadoPor ?? '—'} />
            <Campo label="Destinatario" value={operacion.destinatario ?? '—'} />
            <Campo label="Dirección / Ruta" value={operacion.destinoFinal ?? '—'} />
          </>
        )}

        {operacion.observaciones && (
          <Campo label="Observaciones" value={operacion.observaciones} />
        )}

        {/* Fotos del producto (ingresos) */}
        {operacion.tipo === 'ingreso' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
            <dt className={DT}>Fotos del producto</dt>
            <dd className="sm:col-span-2 flex flex-wrap gap-2">
              {fotosUrls.length > 0 ? (
                fotosUrls.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPreviewFotoIdx(idx)}
                    className="h-8 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    Foto {idx + 1}
                  </button>
                ))
              ) : (
                <span className="text-vialto-steel">Sin fotos</span>
              )}
            </dd>
          </div>
        )}

        {/* Remito PDF (egresos) */}
        {operacion.tipo === 'egreso' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
            <dt className={DT}>Remito PDF</dt>
            <dd className="sm:col-span-2">
              <ImprimirRemitoButton
                variant="compact"
                egresoId={operacion.id}
                tenantId={tenantId}
                titulo={
                  operacion.numeroRemito
                    ? `Remito ${operacion.numeroRemito}`
                    : 'Remito interno'
                }
              />
            </dd>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className={DT}>Registrado</dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">
            {formatInstantEsAr24h(operacion.createdAt)}
          </dd>
        </div>
      </dl>

      {/* â”€â”€ Líneas â”€â”€ */}
      <div className="px-4 pb-4 pt-2">
        <p className={`${DT} mb-2`}>Productos ({operacion.movimientos.length})</p>
        <div className="overflow-x-auto rounded border border-black/10">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-vialto-mist/40">
              <tr>
                <th className={TH}>Producto</th>
                <th className={TH}>Presentación</th>
                <th className={`${TH} text-right`}>Bultos</th>
                <th className={`${TH} text-right`}>Sueltas</th>
                <th className={TH}>Lote</th>
                {operacion.tipo === 'ingreso' && <th className={TH}>Vencimiento</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {operacion.movimientos.map((mov) => (
                <tr key={mov.id} className="hover:bg-vialto-mist/20">
                  <td className={TD}>{mov.producto?.nombre ?? mov.productoId}</td>
                  <td className={TD}>
                    {mov.presentacion?.presentacion?.nombre ?? mov.presentacionId ?? '—'}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{mov.bultos}</td>
                  <td className={`${TD} text-right tabular-nums`}>{mov.unidades}</td>
                  <td className={TD}>{mov.lote ?? '—'}</td>
                  {operacion.tipo === 'ingreso' && (
                    <td className={TD}>
                      {mov.fechaVencimiento
                        ? formatMovimientoStockFechaFromIso(mov.fechaVencimiento)
                        : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewFotoIdx !== null && fotosUrls[previewFotoIdx] && (
        <AdjuntoPreviewModal
          url={fotosUrls[previewFotoIdx]}
          title={`Foto del producto ${previewFotoIdx + 1}`}
          onClose={() => setPreviewFotoIdx(null)}
        />
      )}
    </ViewModalShell>
  );
}
