import { useState } from 'react';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { ImprimirRemitoButton } from '@/components/stock/ImprimirRemitoButton';
import { formatInstantEsAr24h, formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import {
  movimientoStockTipoNumeroClass,
} from '@/lib/stockMovimientoTipo';
import type { MovimientoStock } from '@/types/api';

export function MovimientoStockDetalleBody({
  row,
  tenantId,
}: {
  row: MovimientoStock;
  tenantId?: string;
}) {
  const [previewFotoIdx, setPreviewFotoIdx] = useState<number | null>(null);
  const fotosUrls = row.tipo === 'ingreso' ? (row.fotosUrls ?? []) : [];

  const remitoTitulo = row.numeroRemito?.trim()
    ? `Remito ${row.numeroRemito.trim()}`
    : 'Remito interno';

  return (
    <>
      <dl className="divide-y divide-black/5 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Número de remito
          </dt>
          <dd className="sm:col-span-2 font-mono text-vialto-charcoal">{row.numeroRemito ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Fecha movimiento
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">
            {formatMovimientoStockFechaFromIso(row.fecha, { alwaysShowTime: true })}
          </dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Producto
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">{row.producto?.nombre ?? row.productoId}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Empresa / Cliente
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">{row.cliente?.nombre ?? row.clienteId}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Depósito
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">{row.deposito?.nombre ?? row.depositoId}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            {row.producto?.unidad1Nombre ?? 'Pallets'}
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">
            <span className={movimientoStockTipoNumeroClass(row.tipo)}>{row.cantidad1}</span>
          </dd>
        </div>
        {row.producto?.unidad2Nombre !== null && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
            <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
              {row.producto?.unidad2Nombre ?? 'Unidad'}
            </dt>
            <dd className="sm:col-span-2 text-vialto-charcoal">
              <span className={movimientoStockTipoNumeroClass(row.tipo)}>{row.cantidad2}</span>
            </dd>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Lote
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">{row.lote ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Observaciones
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal whitespace-pre-wrap">{row.observaciones ?? '—'}</dd>
        </div>
        {/* Fotos (ingresos) */}
        {row.tipo === 'ingreso' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
            <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
              Fotos del producto
            </dt>
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

        {row.tipo === 'egreso' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
            <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
              Remito PDF
            </dt>
            <dd className="sm:col-span-2">
              <ImprimirRemitoButton
                variant="compact"
                egresoId={row.operacionId}
                tenantId={tenantId}
                titulo={remitoTitulo}
              />
            </dd>
          </div>
        )}
        {row.tipo === 'egreso' && (
          <>
            <div className="col-span-full px-4 pt-4 pb-1">
              <p className="text-xs font-[family-name:var(--font-ui)] uppercase tracking-wider text-vialto-steel">
                Datos de entrega
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
              <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
                Entregado por
              </dt>
              <dd className="sm:col-span-2 text-vialto-charcoal">{row.entregadoPor ?? '—'}</dd>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
              <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
                Destinatario
              </dt>
              <dd className="sm:col-span-2 text-vialto-charcoal">{row.destinatario ?? '—'}</dd>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
              <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
                Dirección / Ruta
              </dt>
              <dd className="sm:col-span-2 text-vialto-charcoal">{row.destinoFinal ?? '—'}</dd>
            </div>
          </>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Registrado por
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">
            {row.createdByLabel ? (
              <span title={row.createdBy ? `ID: ${row.createdBy}` : undefined}>{row.createdByLabel}</span>
            ) : row.createdBy ? (
              <span className="text-vialto-steel" title={row.createdBy}>
                Usuario no disponible
              </span>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Fecha y hora de registro
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">{formatInstantEsAr24h(row.createdAt)}</dd>
        </div>
      </dl>

      {previewFotoIdx !== null && fotosUrls[previewFotoIdx] && (
        <AdjuntoPreviewModal
          url={fotosUrls[previewFotoIdx]}
          title={`Foto ${previewFotoIdx + 1}`}
          onClose={() => setPreviewFotoIdx(null)}
        />
      )}
    </>
  );
}
