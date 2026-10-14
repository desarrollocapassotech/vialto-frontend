import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";
import { useAuth } from '@clerk/clerk-react';
import { useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { formatCurrencyArFromNumber, maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { createMovimiento, type TipoContraparte, type TipoMovimientoCc } from '@/lib/cuentaCorriente';
import type { ViajeMonedaCodigo } from '@/lib/currencyMask';
import { computeFacturaTotalesFromBases } from '@/lib/facturaTotales';

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
  const [ivaPctStr, setIvaPctStr] = useState('');
  const [moneda, setMoneda] = useState<ViajeMonedaCodigo>('ARS');
  const [fecha, setFecha] = useState(() => hoyArgentinaIso());
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esCargo = tipo === 'cargo';
  const esCliente = tipoContraparte === 'cliente';

  // IVA solo en ventas/compras, mismo campo que Facturas: vacío = sin IVA. El importe
  // cargado es sin IVA y se registra por el total, calculado igual que una factura.
  const ivaPctNum = ivaPctStr.trim() !== '' ? Number(ivaPctStr) : 0;
  const ivaPct = esCargo && Number.isFinite(ivaPctNum) && ivaPctNum > 0 ? ivaPctNum : null;
  const importeNeto = parseCurrencyAr(importeStr) ?? 0;
  const totales =
    ivaPct != null && importeNeto > 0
      ? computeFacturaTotalesFromBases([{ importe: importeNeto, ivaPct }])
      : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const importe = parseCurrencyAr(importeStr);
    if (!importe || importe <= 0) {
      setError('Ingresá un importe mayor a 0.');
      return;
    }
    if (esCargo && (!Number.isFinite(ivaPctNum) || ivaPctNum < 0 || ivaPctNum > 100)) {
      setError('El IVA tiene que ser un porcentaje entre 0 y 100.');
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
        ivaPct: ivaPct ?? undefined,
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

  return (
    <ViewModalShell
      title={`${
        esCargo
          ? esCliente
            ? 'Nueva venta'
            : 'Nueva compra'
          : esCliente
            ? 'Registrar cobro'
            : 'Registrar pago'
      } — ${contraparteNombre}`}
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
            {esCliente ? 'Venta' : 'Compra'}
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
            {esCliente ? 'Cobro' : 'Pago'}
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

        {esCargo && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="cc-iva">
                  IVA (%)
                </label>
                <input
                  id="cc-iva"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputClass}
                  value={ivaPctStr}
                  onChange={(e) => setIvaPctStr(e.target.value)}
                  placeholder="0"
                />
              </div>
              {totales && (
                <div>
                  <label className={labelClass} htmlFor="cc-total">
                    Total con IVA
                  </label>
                  <input
                    id="cc-total"
                    type="text"
                    className={`${inputClass} bg-vialto-mist tabular-nums`}
                    value={`${formatCurrencyArFromNumber(totales.total)} ${moneda}`}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
              )}
            </div>
            {totales && (
              <p className="mt-1 text-xs text-vialto-steel tabular-nums">
                {formatCurrencyArFromNumber(totales.neto)} + IVA{' '}
                {formatCurrencyArFromNumber(totales.iva)} = {formatCurrencyArFromNumber(totales.total)}{' '}
                {moneda}. Se registra por el total.
              </p>
            )}
          </div>
        )}

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
                Vencimiento
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
              Número de comprobante
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
              Medio de {esCliente ? 'cobro' : 'pago'} / referencia
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
