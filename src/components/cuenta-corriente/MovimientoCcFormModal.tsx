import { useAuth } from '@clerk/clerk-react';
import { useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { createMovimiento, type TipoContraparte, type TipoMovimientoCc } from '@/lib/cuentaCorriente';
import type { ViajeMonedaCodigo } from '@/lib/currencyMask';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

type Props = {
  tipoContraparte: TipoContraparte;
  contraparteId: string;
  contraparteNombre: string;
  tipoInicial?: TipoMovimientoCc;
  onClose: () => void;
  onCreated: () => void;
};

export function MovimientoCcFormModal({
  tipoContraparte,
  contraparteId,
  contraparteNombre,
  tipoInicial = 'cargo',
  onClose,
  onCreated,
}: Props) {
  const { getToken } = useAuth();
  const [tipo, setTipo] = useState<TipoMovimientoCc>(tipoInicial);
  const [concepto, setConcepto] = useState('');
  const [importeStr, setImporteStr] = useState('');
  const [moneda, setMoneda] = useState<ViajeMonedaCodigo>('ARS');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const importe = parseCurrencyAr(importeStr);
    if (!importe || importe <= 0) {
      setError('Ingresá un importe mayor a 0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createMovimiento(() => getToken(), {
        ...(tipoContraparte === 'cliente'
          ? { clienteId: contraparteId }
          : { proveedorId: contraparteId }),
        tipo,
        concepto: concepto.trim() || undefined,
        importe,
        moneda,
        fecha,
        fechaVencimiento: fechaVencimiento || undefined,
        numeroComprobante: numeroComprobante.trim() || undefined,
        formaPago: formaPago.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(friendlyError(err, 'cuentaCorriente'));
    } finally {
      setSaving(false);
    }
  }

  const esCargo = tipo === 'cargo';

  return (
    <ViewModalShell
      title={`${esCargo ? 'Nuevo cargo' : 'Registrar pago'} — ${contraparteNombre}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={viewModalBtnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="movimiento-cc-form"
            className={viewModalBtnPrimary}
            disabled={saving}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="movimiento-cc-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTipo('cargo')}
            className={`flex-1 h-10 text-sm uppercase tracking-wider border ${
              esCargo
                ? 'bg-vialto-charcoal text-white border-vialto-charcoal'
                : 'border-black/20 text-vialto-steel hover:bg-vialto-mist'
            }`}
          >
            Cargo (deuda)
          </button>
          <button
            type="button"
            onClick={() => setTipo('pago')}
            className={`flex-1 h-10 text-sm uppercase tracking-wider border ${
              !esCargo
                ? 'bg-vialto-charcoal text-white border-vialto-charcoal'
                : 'border-black/20 text-vialto-steel hover:bg-vialto-mist'
            }`}
          >
            {tipoContraparte === 'cliente' ? 'Cobranza' : 'Pago'}
          </button>
        </div>

        <div>
          <label className={labelClass} htmlFor="cc-concepto">
            Concepto
          </label>
          <input
            id="cc-concepto"
            type="text"
            className={inputClass}
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={esCargo ? 'Ej. Factura 0001-00001234' : 'Ej. Transferencia recibida'}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="cc-importe">
              Importe
            </label>
            <input
              id="cc-importe"
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={importeStr}
              onChange={(e) => setImporteStr(maskCurrencyArInput(e.target.value))}
              placeholder="0,00"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cc-moneda">
              Moneda
            </label>
            <MonedaSelect id="cc-moneda" value={moneda} onChange={setMoneda} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="cc-fecha">
              Fecha
            </label>
            <input
              id="cc-fecha"
              type="date"
              className={inputClass}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </div>
          {esCargo && (
            <div>
              <label className={labelClass} htmlFor="cc-vencimiento">
                Vencimiento (opcional)
              </label>
              <input
                id="cc-vencimiento"
                type="date"
                className={inputClass}
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </div>
          )}
        </div>

        {esCargo ? (
          <div>
            <label className={labelClass} htmlFor="cc-comprobante">
              Número de comprobante (opcional)
            </label>
            <input
              id="cc-comprobante"
              type="text"
              className={inputClass}
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              placeholder="Si no factura desde Vialto, el número de tu comprobante externo"
            />
          </div>
        ) : (
          <div>
            <label className={labelClass} htmlFor="cc-forma-pago">
              Medio de pago / referencia (opcional)
            </label>
            <input
              id="cc-forma-pago"
              type="text"
              className={inputClass}
              value={formaPago}
              onChange={(e) => setFormaPago(e.target.value)}
              placeholder="Ej. Transferencia, cheque N° 123"
            />
          </div>
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
