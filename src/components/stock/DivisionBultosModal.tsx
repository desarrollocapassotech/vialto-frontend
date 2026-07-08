import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus } from 'lucide-react';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { Spinner } from '@/components/ui/Spinner';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { modalQuickCreateOverlayClass } from '@/lib/modalLayers';
import {
  STOCK_SIN_LOTE_VALUE,
  loteEgresoParaApi,
} from '@/lib/stockLote';
import type { LoteStockDisponible } from '@/components/stock/EgresoProductoLoteBloque';

const LABEL =
  'text-xs font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

export type DivisionBultosModalContext = {
  rowKey: string;
  /** Clave de la línea de lote dentro del producto (multi-lote). */
  loteKey: string;
  clienteId: string;
  depositoId: string;
  productoId: string;
  productoLabel: string;
  presentacionId: string;
  presentacionLabel: string;
  unidadesPorBulto: number;
  lote: string;
  loteStock: LoteStockDisponible;
  labels?: { bultos: string; sueltas: string };
};

export function DivisionBultosModal({
  ctx,
  tenantId,
  onClose,
  onSuccess,
}: {
  ctx: DivisionBultosModalContext;
  tenantId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getToken } = useAuth();
  useLockBodyScroll(true);
  const labels = ctx.labels ?? { bultos: 'bultos', sueltas: 'sueltas' };
  const bultosDisponibles = ctx.loteStock.bultos;
  const [bultos, setBultos] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sueltasResultantes = bultos * ctx.unidadesPorBulto;
  const loteLabel =
    ctx.lote === STOCK_SIN_LOTE_VALUE ? 'Sin lote' : ctx.lote;

  const divisionesUrl = tenantId
    ? `/api/platform/stock/divisiones?tenantId=${encodeURIComponent(tenantId)}`
    : '/api/stock/divisiones';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleSubmit() {
    setFormError(null);

    if (bultos < 1) {
      setFormError('La cantidad de bultos debe ser al menos 1.');
      return;
    }
    if (bultosDisponibles > 0 && bultos > bultosDisponibles) {
      setFormError(
        `Stock insuficiente. Tenés ${bultosDisponibles} ${labels.bultos} disponible${bultosDisponibles !== 1 ? 's' : ''}.`,
      );
      return;
    }

    const loteApi = loteEgresoParaApi(ctx.lote);
    setSaving(true);
    try {
      await apiJson(divisionesUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          productoId: ctx.productoId,
          presentacionId: ctx.presentacionId,
          clienteId: ctx.clienteId,
          depositoId: ctx.depositoId,
          bultos,
          fecha: new Date().toISOString(),
          ...(loteApi ? { lote: loteApi } : {}),
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(friendlyError(err, 'stock'));
    } finally {
      setSaving(false);
    }
  }

  const modal = (
    <div
      className={modalQuickCreateOverlayClass(true)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="division-bultos-modal-title"
        className="flex max-h-[95dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-h-[90vh] sm:rounded"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <h2
            id="division-bultos-modal-title"
            className="text-lg font-semibold text-vialto-charcoal"
          >
            Desarmar {labels.bultos}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none disabled:opacity-50"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="space-y-4 p-4">
            <p className="text-sm text-vialto-steel">
              Convertí {labels.bultos} en {labels.sueltas} sin salir del egreso. El stock del lote
              se actualizará al confirmar.
            </p>

            <div className="grid grid-cols-2 gap-3 rounded border border-black/10 bg-vialto-mist/30 p-3 text-sm">
              <div>
                <p className={LABEL}>Producto</p>
                <p className="mt-1 font-medium text-vialto-charcoal">{ctx.productoLabel}</p>
              </div>
              <div>
                <p className={LABEL}>Presentación</p>
                <p className="mt-1 font-medium text-vialto-charcoal">{ctx.presentacionLabel}</p>
              </div>
              <div>
                <p className={LABEL}>Lote</p>
                <p className="mt-1 font-medium text-vialto-charcoal">{loteLabel}</p>
              </div>
              <div>
                <p className={LABEL}>Disponible</p>
                <p className="mt-1 font-medium text-vialto-charcoal">
                  {bultosDisponibles} {labels.bultos}
                  {ctx.loteStock.sueltas > 0 && (
                    <span className="font-normal text-vialto-steel">
                      {' '}
                      · {ctx.loteStock.sueltas} {labels.sueltas}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-black/10 overflow-hidden">
              <div className="bg-vialto-mist/40 border-b border-black/10 px-4 py-2 text-center">
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  ¿Cuántos {labels.bultos} querés dividir?
                </p>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setBultos((n) => Math.max(1, n - 1))}
                    disabled={bultos <= 1 || saving}
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-black/20 bg-white hover:bg-vialto-mist/60 disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4 text-vialto-charcoal" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={bultosDisponibles > 0 ? bultosDisponibles : undefined}
                    value={bultos}
                    disabled={saving}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10) || 1;
                      setBultos(Math.max(1, v));
                    }}
                    className="w-20 text-center text-3xl font-bold border-0 border-b-2 border-vialto-charcoal bg-transparent focus:outline-none focus:border-vialto-fire text-vialto-charcoal"
                  />
                  <button
                    type="button"
                    onClick={() => setBultos((n) => n + 1)}
                    disabled={
                      saving || (bultosDisponibles > 0 && bultos >= bultosDisponibles)
                    }
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-black/20 bg-white hover:bg-vialto-mist/60 disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4 text-vialto-charcoal" />
                  </button>
                </div>
                <p className="text-center text-xs text-vialto-steel">
                  1 {labels.bultos.slice(0, -1) || 'bulto'} = {ctx.unidadesPorBulto}{' '}
                  {labels.sueltas}
                </p>

                <div className="flex items-stretch justify-center gap-2 text-sm">
                  <div className="flex-1 rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                    <p className="text-xs uppercase tracking-wider text-red-400">Sale</p>
                    <p className="text-2xl font-bold text-red-600">−{bultos}</p>
                    <p className="text-red-500">{labels.bultos}</p>
                  </div>
                  <div className="flex items-center text-xl text-vialto-steel/50">→</div>
                  <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                    <p className="text-xs uppercase tracking-wider text-emerald-500">Entra</p>
                    <p className="text-2xl font-bold text-emerald-700">+{sueltasResultantes}</p>
                    <p className="text-emerald-600">{labels.sueltas}</p>
                  </div>
                </div>
              </div>
            </div>

            <CrudFormErrorAlert message={formError} />
          </div>

          <div className="mt-auto flex justify-end gap-2 border-t border-black/10 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-black/20 rounded hover:bg-vialto-mist/60 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || bultosDisponibles <= 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-vialto-fire text-white rounded hover:bg-vialto-fire/90 disabled:opacity-50"
            >
              {saving && <Spinner className="h-4 w-4" />}
              {saving ? 'Guardando…' : 'Registrar división'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
