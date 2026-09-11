import { useAuth } from '@clerk/clerk-react';
import { useMemo, useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { formatCurrencyArFromNumber, maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { crearImputacion, type MovimientoCc } from '@/lib/cuentaCorriente';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

type Props = {
  cargo: MovimientoCc;
  pagosDisponibles: MovimientoCc[];
  onClose: () => void;
  onDone: () => void;
};

export function ImputarPagoModal({ cargo, pagosDisponibles, onClose, onDone }: Props) {
  const { getToken } = useAuth();
  const [pagoId, setPagoId] = useState(pagosDisponibles[0]?.id ?? '');
  const [importeStr, setImporteStr] = useState(() =>
    formatCurrencyArFromNumber(cargo.importe),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pagoSeleccionado = useMemo(
    () => pagosDisponibles.find((p) => p.id === pagoId) ?? null,
    [pagosDisponibles, pagoId],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pagoId) {
      setError('Elegí un pago para imputar.');
      return;
    }
    const importe = parseCurrencyAr(importeStr);
    if (!importe || importe <= 0) {
      setError('Ingresá un importe mayor a 0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await crearImputacion(() => getToken(), { pagoId, cargoId: cargo.id, importe });
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
      title={`Imputar pago — ${cargo.concepto}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={viewModalBtnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="imputar-pago-form"
            className={viewModalBtnPrimary}
            disabled={saving || pagosDisponibles.length === 0}
          >
            {saving ? 'Guardando…' : 'Imputar'}
          </button>
        </>
      }
    >
      <form id="imputar-pago-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-vialto-steel">
          Cargo por <strong>{formatCurrencyArFromNumber(cargo.importe)} {cargo.moneda}</strong>,
          vence{' '}
          {cargo.fechaVencimiento
            ? new Date(cargo.fechaVencimiento).toLocaleDateString('es-AR')
            : 'sin fecha configurada'}
          .
        </p>

        {pagosDisponibles.length === 0 ? (
          <p className="text-sm text-vialto-steel bg-vialto-mist/60 border border-black/10 rounded px-3 py-2">
            No hay pagos sin imputar en {cargo.moneda} para esta cuenta. Registrá un pago primero.
          </p>
        ) : (
          <>
            <div>
              <label className={labelClass} htmlFor="cc-pago-select">
                Pago a imputar
              </label>
              <select
                id="cc-pago-select"
                className={inputClass}
                value={pagoId}
                onChange={(e) => setPagoId(e.target.value)}
              >
                {pagosDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {new Date(p.fecha).toLocaleDateString('es-AR')} — {formatCurrencyArFromNumber(p.importe)}{' '}
                    {p.moneda}
                    {p.concepto ? ` (${p.concepto})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="cc-imputar-importe">
                Importe a imputar
              </label>
              <input
                id="cc-imputar-importe"
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={importeStr}
                onChange={(e) => setImporteStr(maskCurrencyArInput(e.target.value))}
                required
              />
              {pagoSeleccionado && (
                <p className="mt-1 text-xs text-vialto-steel">
                  El pago es de {formatCurrencyArFromNumber(pagoSeleccionado.importe)} {pagoSeleccionado.moneda}
                  {pagoSeleccionado.moneda !== cargo.moneda &&
                    ' — atención, distinta moneda que el cargo, el servidor lo va a rechazar.'}
                </p>
              )}
            </div>
          </>
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
