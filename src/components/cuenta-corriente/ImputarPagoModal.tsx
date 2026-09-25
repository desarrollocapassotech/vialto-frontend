import { useAuth } from '@clerk/clerk-react';
import { useMemo, useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { formatCurrencyArFromNumber, maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { crearImputacion, createMovimiento, type MovimientoCc } from '@/lib/cuentaCorriente';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

type Props = {
  cargo: MovimientoCc;
  pagosDisponibles: MovimientoCc[];
  onClose: () => void;
  onDone: () => void;
};

type Modo = 'existente' | 'nuevo';

export function ImputarPagoModal({ cargo, pagosDisponibles, onClose, onDone }: Props) {
  const { getToken } = useAuth();
  const esCliente = !!cargo.clienteId;
  const pendienteCargo = cargo.pendiente ?? cargo.importe;

  const [modo, setModo] = useState<Modo>(pagosDisponibles.length > 0 ? 'existente' : 'nuevo');

  // Modo "existente": elegir un pago ya cargado y cuánto imputarle.
  const [pagoId, setPagoId] = useState(pagosDisponibles[0]?.id ?? '');
  const [importeStr, setImporteStr] = useState(() => formatCurrencyArFromNumber(pendienteCargo));
  const pagoSeleccionado = useMemo(
    () => pagosDisponibles.find((p) => p.id === pagoId) ?? null,
    [pagosDisponibles, pagoId],
  );

  // Modo "nuevo": cargar el cobro/pago ahí mismo y aplicarlo de una.
  const [nuevoImporteStr, setNuevoImporteStr] = useState(() => formatCurrencyArFromNumber(pendienteCargo));
  const [nuevaFecha, setNuevaFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [nuevaFormaPago, setNuevaFormaPago] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (modo === 'existente') {
      if (!pagoId) {
        setError(`Elegí ${esCliente ? 'un cobro' : 'un pago'} para imputar.`);
        return;
      }
      const importe = parseCurrencyAr(importeStr);
      if (!importe || importe <= 0) {
        setError('Ingresá un importe mayor a 0.');
        return;
      }
      setSaving(true);
      try {
        await crearImputacion(() => getToken(), { pagoId, cargoId: cargo.id, importe });
        onDone();
        onClose();
      } catch (err) {
        setError(friendlyError(err, 'cuentaCorriente'));
      } finally {
        setSaving(false);
      }
      return;
    }

    // modo === 'nuevo'
    const importeNuevo = parseCurrencyAr(nuevoImporteStr);
    if (!importeNuevo || importeNuevo <= 0) {
      setError('Ingresá un importe mayor a 0.');
      return;
    }
    setSaving(true);
    try {
      const pagoCreado = await createMovimiento(() => getToken(), {
        ...(cargo.clienteId ? { clienteId: cargo.clienteId } : { proveedorId: cargo.proveedorId! }),
        tipo: 'pago',
        importe: importeNuevo,
        moneda: cargo.moneda,
        fecha: nuevaFecha,
        formaPago: nuevaFormaPago.trim() || undefined,
      });
      await crearImputacion(() => getToken(), {
        pagoId: pagoCreado.id,
        cargoId: cargo.id,
        importe: Math.min(importeNuevo, pendienteCargo),
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
      title={`${esCliente ? 'Imputar cobro' : 'Imputar pago'} — ${cargo.concepto}`}
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
            disabled={saving || (modo === 'existente' && pagosDisponibles.length === 0)}
          >
            {saving ? 'Guardando…' : 'Imputar'}
          </button>
        </>
      }
    >
      <form id="imputar-pago-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-vialto-steel">
          {esCliente ? 'Venta' : 'Compra'} por{' '}
          <strong>{formatCurrencyArFromNumber(cargo.importe)} {cargo.moneda}</strong>
          {cargo.pendiente != null && cargo.pendiente !== cargo.importe && (
            <> (pendiente {formatCurrencyArFromNumber(cargo.pendiente)} {cargo.moneda})</>
          )}
          , vence{' '}
          {cargo.fechaVencimiento
            ? new Date(cargo.fechaVencimiento).toLocaleDateString('es-AR')
            : 'sin fecha configurada'}
          .
        </p>

        {pagosDisponibles.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModo('existente')}
              className={`flex-1 h-9 text-xs uppercase tracking-wider border ${
                modo === 'existente'
                  ? 'bg-vialto-charcoal text-white border-vialto-charcoal'
                  : 'border-black/20 text-vialto-steel hover:bg-vialto-mist'
              }`}
            >
              Usar {esCliente ? 'un cobro' : 'un pago'} existente
            </button>
            <button
              type="button"
              onClick={() => setModo('nuevo')}
              className={`flex-1 h-9 text-xs uppercase tracking-wider border ${
                modo === 'nuevo'
                  ? 'bg-vialto-charcoal text-white border-vialto-charcoal'
                  : 'border-black/20 text-vialto-steel hover:bg-vialto-mist'
              }`}
            >
              Registrar {esCliente ? 'un cobro' : 'un pago'} nuevo
            </button>
          </div>
        )}

        {modo === 'existente' ? (
          <>
            <div>
              <label className={labelClass} htmlFor="cc-pago-select">
                {esCliente ? 'Cobro' : 'Pago'} a imputar
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
                  {esCliente ? 'El cobro es' : 'El pago es'} de{' '}
                  {formatCurrencyArFromNumber(pagoSeleccionado.importe)} {pagoSeleccionado.moneda}
                  {pagoSeleccionado.moneda !== cargo.moneda &&
                    ` — atención, distinta moneda que ${esCliente ? 'la venta' : 'la compra'}, el servidor lo va a rechazar.`}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="cc-nuevo-importe">
                  Importe
                </label>
                <input
                  id="cc-nuevo-importe"
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  value={nuevoImporteStr}
                  onChange={(e) => setNuevoImporteStr(maskCurrencyArInput(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="cc-nueva-fecha">
                  Fecha
                </label>
                <input
                  id="cc-nueva-fecha"
                  type="date"
                  className={inputClass}
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="cc-nueva-forma-pago">
                Medio de {esCliente ? 'cobro' : 'pago'} / referencia (opcional)
              </label>
              <input
                id="cc-nueva-forma-pago"
                type="text"
                className={inputClass}
                value={nuevaFormaPago}
                onChange={(e) => setNuevaFormaPago(e.target.value)}
                placeholder="Ej. Transferencia, efectivo"
              />
            </div>
            <p className="text-xs text-vialto-steel">
              Se registra en {cargo.moneda} y se imputa a esta {esCliente ? 'venta' : 'compra'} automáticamente.
            </p>
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
