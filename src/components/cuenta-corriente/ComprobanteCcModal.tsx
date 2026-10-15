import { useAuth } from '@clerk/clerk-react';
import { useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
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
 * Carga o corrige el N° de comprobante de un movimiento: la factura del proveedor en una
 * liquidación sin ARCA (se guarda en la liquidación) o una venta/compra manual.
 */
export function ComprobanteCcModal({ movimiento, onClose, onDone }: Props) {
  const { getToken } = useAuth();
  const [numero, setNumero] = useState(movimiento.numeroComprobante ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esLiquidacion = movimiento.origen === 'liquidacion';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await actualizarComprobanteMovimiento(() => getToken(), movimiento.id, numero.trim() || null);
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
      <form id="comprobante-cc-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="cc-numero-comprobante">
            {esLiquidacion ? 'N° de factura del proveedor' : 'N° de comprobante'}
          </label>
          <input
            id="cc-numero-comprobante"
            type="text"
            maxLength={64}
            className={inputClass}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ej. 0001-00001234"
            autoFocus
          />
          {esLiquidacion && (
            <p className="mt-1 text-xs text-vialto-steel">
              Se guarda en la liquidación: también se ve y se puede editar desde Liquidaciones.
            </p>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
      </form>
    </ViewModalShell>
  );
}
