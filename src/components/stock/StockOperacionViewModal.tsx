import { useState } from 'react';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { DivisionImpactoLinea } from '@/components/stock/DivisionImpactoLinea';
import { ImprimirRemitoButton } from '@/components/stock/ImprimirRemitoButton';
import { StockOperacionTipoCelda } from '@/components/stock/StockOperacionTipoCelda';
import { ViewModalShell, viewModalBtnGhost } from '@/components/ui/ViewModalShell';
import { getDivisionImpacto } from '@/lib/stockDivision';
import { etiquetaStockDocumentoExterno } from '@/lib/stockDocumentoExterno';
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
  const divisionImpacto =
    operacion.tipo === 'division' ? getDivisionImpacto(operacion) : null;

  const titulo =
    operacion.tipo === 'division'
      ? 'División de bultos'
      : operacion.tipo === 'ingreso'
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

        {operacion.tipo === 'division' && divisionImpacto && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
            <dt className={DT}>Transformación</dt>
            <dd className="sm:col-span-2">
              <DivisionImpactoLinea impacto={divisionImpacto} />
            </dd>
          </div>
        )}

        {operacion.tipo === 'division' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
            <dt className={DT}>Tipo</dt>
            <dd className="sm:col-span-2">
              <StockOperacionTipoCelda tipo={operacion.tipo} />
            </dd>
          </div>
        )}

        {operacion.tipo === 'egreso' && operacion.numeroRemito && (
          <Campo label="N° Remito" value={operacion.numeroRemito} mono />
        )}

        {operacion.tipo === 'ingreso' && operacion.numeroRemitoProveedor && (
          <Campo label="N° Remito Proveedor" value={operacion.numeroRemitoProveedor} mono />
        )}

        {operacion.tipo === 'egreso' && (
          <>
            <Campo
              label="Nº documento externo"
              value={etiquetaStockDocumentoExterno(operacion.numeroDocumentoExterno)}
            />
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
        <p className={`${DT} mb-2`}>
          {operacion.tipo === 'division' ? 'Producto' : `Productos (${operacion.movimientos.length})`}
        </p>
        <div className="overflow-x-auto rounded border border-black/10">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-vialto-mist/40">
              <tr>
                <th className={TH}>Producto</th>
                <th className={TH}>Presentación</th>
                {operacion.tipo === 'division' ? (
                  <th className={TH}>Transformación</th>
                ) : (
                  <>
                    <th className={`${TH} text-right`}>Bultos</th>
                    <th className={`${TH} text-right`}>Sueltas</th>
                  </>
                )}
                <th className={TH}>Lote</th>
                {operacion.tipo === 'ingreso' && <th className={TH}>Vencimiento</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {operacion.tipo === 'division' && divisionImpacto ? (
                <tr className="hover:bg-vialto-mist/20">
                  <td className={TD}>
                    {divisionImpacto.productoNombre ??
                      operacion.movimientos[0]?.producto?.nombre ??
                      operacion.movimientos[0]?.productoId}
                  </td>
                  <td className={TD}>
                    {operacion.movimientos[0]?.presentacion?.presentacion?.nombre ??
                      operacion.movimientos[0]?.presentacionId ??
                      '—'}
                  </td>
                  <td className={TD}>
                    <DivisionImpactoLinea impacto={divisionImpacto} />
                  </td>
                  <td className={TD}>
                    {operacion.movimientos[0]?.lote ?? (
                      <span className="text-vialto-steel">Sin lote</span>
                    )}
                  </td>
                </tr>
              ) : (
                operacion.movimientos.map((mov) => (
                  <tr key={mov.id} className="hover:bg-vialto-mist/20">
                    <td className={TD}>{mov.producto?.nombre ?? mov.productoId}</td>
                    <td className={TD}>
                      {mov.presentacion?.presentacion?.nombre ?? mov.presentacionId ?? '—'}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{mov.bultos}</td>
                    <td className={`${TD} text-right tabular-nums`}>{mov.unidades}</td>
                    <td className={TD}>
                      {mov.lote ?? <span className="text-vialto-steel">Sin lote</span>}
                    </td>
                    {operacion.tipo === 'ingreso' && (
                      <td className={TD}>
                        {mov.fechaVencimiento
                          ? formatMovimientoStockFechaFromIso(mov.fechaVencimiento)
                          : '—'}
                      </td>
                    )}
                  </tr>
                ))
              )}
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
