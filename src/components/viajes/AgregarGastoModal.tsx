import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  maskCurrencyForMoneda,
  parseCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import type { Viaje } from '@/types/api';

type Props = {
  open: boolean;
  viaje: Viaje | null;
  onSuccess: (updated: Viaje) => void;
  onClose: () => void;
};

export function AgregarGastoModal({ open, viaje, onSuccess, onClose }: Props) {
  const { getToken } = useAuth();
  const [descripcion, setDescripcion] = useState('');
  const [montoStr, setMontoStr] = useState('');
  const [moneda, setMoneda] = useState<ViajeMonedaCodigo>('ARS');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open || viaje == null) return null;
  const viajeActual = viaje;

  function resetForm() {
    setDescripcion('');
    setMontoStr('');
    setMoneda('ARS');
    setFecha(new Date().toISOString().slice(0, 10));
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!descripcion.trim()) {
      setError('Ingresá una descripción.');
      return;
    }
    const monto = parseCurrencyForMoneda(montoStr, moneda);
    if (monto == null || monto < 0) {
      setError('Ingresá un monto válido mayor o igual a 0.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        descripcion: descripcion.trim(),
        monto,
        moneda,
      };
      if (fecha.trim()) body.fecha = fecha.trim();

      const updated = await apiJson<Viaje>(
        `/api/viajes/${encodeURIComponent(viajeActual.id)}/gastos`,
        () => getToken(),
        { method: 'POST', body: JSON.stringify(body) },
      );
      resetForm();
      onSuccess(updated);
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setSaving(false);
    }
  }

  const labelClass =
    'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';
  const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agregar-gasto-title"
    >
      <div className="w-full max-w-sm rounded border border-black/15 bg-white p-5 shadow-lg">
        <h2
          id="agregar-gasto-title"
          className="text-sm font-semibold text-vialto-charcoal"
        >
          Agregar gasto — Viaje {viajeActual.numero}
        </h2>
        <p className="mt-1 text-xs text-vialto-steel">
          El gasto se suma al total del viaje.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Descripción</span>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Peaje, estadía, reparación…"
              className={inputClass}
              autoFocus
              disabled={saving}
              aria-label="Descripción del gasto"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={labelClass}>Monto</span>
              <input
                type="text"
                inputMode="decimal"
                value={montoStr}
                onChange={(e) =>
                  setMontoStr(maskCurrencyForMoneda(e.target.value, moneda))
                }
                placeholder={moneda === 'USD' ? 'Ej. 120.50' : 'Ej. 15.000,00'}
                className={`${inputClass} text-right tabular-nums`}
                disabled={saving}
                aria-label="Monto del gasto"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>Moneda</span>
              <select
                value={moneda}
                onChange={(e) => {
                  setMoneda(e.target.value as ViajeMonedaCodigo);
                  setMontoStr('');
                }}
                disabled={saving}
                className="h-9 w-20 border border-black/15 bg-white px-2 text-sm"
                aria-label="Moneda del gasto"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className={labelClass}>Fecha (opcional)</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputClass}
              disabled={saving}
              aria-label="Fecha del gasto"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleClose}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}
