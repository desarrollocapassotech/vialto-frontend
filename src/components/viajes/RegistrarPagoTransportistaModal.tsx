import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  maskCurrencyForMoneda,
  normalizeViajeMoneda,
  parseCurrencyForMoneda,
} from '@/lib/currencyMask';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import { calcularSaldoTransportista } from '@/lib/viajesTransportistaPagos';
import type { Viaje } from '@/types/api';

type Props = {
  open: boolean;
  viaje: Viaje | null;
  onSuccess: (updated: Viaje) => void;
  onClose: () => void;
};

export function RegistrarPagoTransportistaModal({ open, viaje, onSuccess, onClose }: Props) {
  const { getToken } = useAuth();
  const [montoStr, setMontoStr] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPagosAnteriores, setShowPagosAnteriores] = useState(false);

  if (!open || viaje == null) return null;
  const viajeActual = viaje;
  const moneda = normalizeViajeMoneda(viajeActual.monedaPrecioTransportistaExterno);

  const saldo = calcularSaldoTransportista(viajeActual);
  const pagos = viajeActual.pagosTransportista ?? [];

  function resetForm() {
    setMontoStr('');
    setFecha(new Date().toISOString().slice(0, 10));
    setObservaciones('');
    setError(null);
    setShowPagosAnteriores(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    const monto = parseCurrencyForMoneda(montoStr, moneda);
    if (monto == null || monto <= 0) {
      setError('Ingresá un monto mayor a 0.');
      return;
    }
    if (saldo) {
      if (saldo.saldo <= 0) {
        setError('El transportista ya está pagado en su totalidad.');
        return;
      }
      if (monto > saldo.saldo) {
        setError(`El monto supera el saldo pendiente (${formatViajeImporteForListado(saldo.saldo, saldo.moneda)}).`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { monto, moneda, fecha };
      if (observaciones.trim()) body.observaciones = observaciones.trim();

      const updated = await apiJson<Viaje>(
        `/api/viajes/${encodeURIComponent(viajeActual.id)}/pagos-transportista`,
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
      aria-labelledby="registrar-pago-title"
    >
      <div className="w-full max-w-sm rounded border border-black/15 bg-white p-5 shadow-lg">
        <h2
          id="registrar-pago-title"
          className="text-sm font-semibold text-vialto-charcoal"
        >
          Registrar pago — Viaje {viajeActual.numero}
        </h2>

        {saldo && saldo.totalAcordado > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded border border-black/10 bg-vialto-mist/60 px-3 py-2 text-xs">
            <span className="text-vialto-steel">
              Acordado:{' '}
              <span className="font-medium text-vialto-charcoal">
                {formatViajeImporteForListado(saldo.totalAcordado, saldo.moneda)}
              </span>
            </span>
            <span className="text-vialto-steel">
              Saldo:{' '}
              <span className={`font-medium ${saldo.pagado ? 'text-emerald-700' : 'text-red-700'}`}>
                {saldo.pagado
                  ? 'Pagado'
                  : formatViajeImporteForListado(saldo.saldo, saldo.moneda)}
              </span>
            </span>
            {pagos.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPagosAnteriores((prev) => !prev)}
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded border border-black/10 bg-white transition hover:bg-vialto-mist"
                aria-expanded={showPagosAnteriores}
                aria-label={showPagosAnteriores ? 'Ocultar pagos anteriores' : 'Mostrar pagos anteriores'}
                title={showPagosAnteriores ? 'Ocultar pagos anteriores' : 'Mostrar pagos anteriores'}
              >
                <img
                  src="/icono-historial.png"
                  alt={showPagosAnteriores ? 'Ocultar pagos anteriores' : 'Mostrar pagos anteriores'}
                  className="h-5 w-5"
                />
              </button>
            )}
          </div>
        )}

        {showPagosAnteriores && pagos.length > 0 && (
          <div className="mt-4 rounded border border-black/10 bg-white p-3 text-sm">
            <div className="mb-2 text-xs uppercase tracking-[0.15em] text-vialto-steel">
              Pagos anteriores
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 text-xs text-vialto-steel border-b border-black/10 pb-2">
              <span>Monto</span>
              <span className="text-right">Fecha</span>
            </div>
            <div className="mt-2 space-y-2">
              {pagos.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-sm text-vialto-charcoal">
                  <div className="group relative min-w-0">
                    <span className={`font-medium tabular-nums ${p.observaciones ? 'cursor-default underline decoration-dotted underline-offset-2' : ''}`}>
                      {formatViajeImporteForListado(p.monto, p.moneda)}
                    </span>
                    {p.observaciones && (
                      <div className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1 w-48 rounded border border-black/10 bg-vialto-charcoal px-2 py-1.5 text-xs font-normal text-white shadow-md opacity-0 transition-[opacity,visibility] group-hover:visible group-hover:opacity-100">
                        {p.observaciones}
                      </div>
                    )}
                  </div>
                  <span className="text-right text-vialto-steel tabular-nums">
                    {p.fecha
                      ? new Date(p.fecha).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
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
                placeholder={moneda === 'USD' ? 'Ej. 1,500.00' : 'Ej. 150.000,00'}
                className={`${inputClass} text-right tabular-nums`}
                autoFocus
                disabled={saving}
                aria-label="Monto del pago"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>Moneda</span>
              <span className="flex h-9 items-center text-sm font-medium text-vialto-charcoal">{moneda}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex flex-col gap-1">
              <span className={labelClass}>Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputClass}
                disabled={saving}
                aria-label="Fecha del pago"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>Observaciones</span>
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas opcionales"
                className={inputClass}
                disabled={saving}
                aria-label="Observaciones del pago"
              />
            </div>
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
            {saving ? 'Guardando…' : 'Guardar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}
