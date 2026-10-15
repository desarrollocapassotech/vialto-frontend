import { useAuth } from '@clerk/clerk-react';
import { useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { fechaDiaYmd } from '@/lib/fmtDateUtc';
import { friendlyError } from '@/lib/friendlyError';
import { actualizarComprobanteMovimiento, type MovimientoCc } from '@/lib/cuentaCorriente';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

type Props = {
  movimiento: MovimientoCc;
  onClose: () => void;
  onDone: () => void;
};

/**
 * Carga o corrige el N° de comprobante y el vencimiento de un movimiento: una factura de
 * cliente (se guarda en la factura; el número solo sin ARCA), la factura del proveedor en
 * una liquidación (el número solo sin CVLP; se guarda en la liquidación) o una
 * venta/compra manual.
 */
export function ComprobanteCcModal({ movimiento, onClose, onDone }: Props) {
  const { getToken } = useAuth();
  const numeroEditable = !!movimiento.comprobanteEditable;
  const vencimientoEditable = !!movimiento.vencimientoEditable;
  const [numero, setNumero] = useState(movimiento.numeroComprobante ?? '');
  const [vencimiento, setVencimiento] = useState(fechaDiaYmd(movimiento.fechaVencimiento) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esLiquidacion = movimiento.origen === 'liquidacion';
  const esFactura = movimiento.origen === 'factura';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await actualizarComprobanteMovimiento(() => getToken(), movimiento.id, {
        ...(numeroEditable ? { numeroComprobante: numero.trim() || null } : {}),
        ...(vencimientoEditable ? { fechaVencimiento: vencimiento || null } : {}),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(friendlyError(err, 'cuentaCorriente'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewModalShell
      title={`Comprobante — ${movimiento.concepto}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={viewModalBtnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="comprobante-cc-form"
            className={viewModalBtnPrimary}
            disabled={saving}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="comprobante-cc-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="cc-numero-comprobante">
            {esLiquidacion
              ? 'N° de factura del proveedor'
              : esFactura
                ? 'N° de factura'
                : 'N° de comprobante'}
          </label>
          {numeroEditable ? (
            <>
              <input
                id="cc-numero-comprobante"
                type="text"
                maxLength={64}
                className={inputClass}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ej. 0001-00001234"
                required={esFactura}
                autoFocus
              />
              {esLiquidacion && (
                <p className="mt-1 text-xs text-vialto-steel">
                  Se guarda en la liquidación: también se ve y se puede editar desde Liquidaciones.
                </p>
              )}
            </>
          ) : (
            <p id="cc-numero-comprobante" className="text-sm text-vialto-charcoal">
              {movimiento.numeroComprobante ?? '—'}
              <span className="block text-xs text-vialto-steel">
                {movimiento.numeroComprobante
                  ? 'Es el número del comprobante emitido con ARCA: no se modifica.'
                  : 'Lo asigna ARCA al emitir el comprobante.'}
              </span>
            </p>
          )}
        </div>

        {vencimientoEditable && (
          <div>
            <label className={labelClass} htmlFor="cc-vencimiento">
              Vencimiento
            </label>
            <input
              id="cc-vencimiento"
              type="date"
              className={inputClass}
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
            />
          </div>
        )}

        {esFactura && (
          <p className="text-xs text-vialto-steel">
            Se guarda en la factura: también se ve y se puede editar desde Facturas.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
      </form>
    </ViewModalShell>
  );
}
