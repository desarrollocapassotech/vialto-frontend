import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import { useAuth } from '@clerk/clerk-react';
import { useMemo, useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { formatCurrencyArFromNumber, maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import {
  crearImputacion,
  crearImputacionMultiple,
  createMovimiento,
  repartirImputacion,
  type MovimientoCc,
} from '@/lib/cuentaCorriente';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

type Props = {
  cargo: MovimientoCc;
  pagosDisponibles: MovimientoCc[];
  onClose: () => void;
  onDone: () => void;
};

type Modo = 'existente' | 'nuevo';

const EPS = 0.005;

/** Lo que le queda sin imputar a un cobro/pago (`pendiente` lo calcula el backend: importe − imputado). */
function disponiblePago(p: MovimientoCc): number {
  return p.pendiente ?? p.importe;
}

function etiquetaPago(p: MovimientoCc): string {
  const disponible = disponiblePago(p);
  const usado = Math.abs(disponible - p.importe) > EPS;
  return (
    `${fmtDateUtc(p.fecha)} — ${formatCurrencyArFromNumber(disponible)} ${p.moneda}` +
    (usado ? ` disponibles de ${formatCurrencyArFromNumber(p.importe)} ${p.moneda}` : '') +
    (p.concepto ? ` (${p.concepto})` : '')
  );
}

export function ImputarPagoModal({ cargo, pagosDisponibles, onClose, onDone }: Props) {
  const { getToken } = useAuth();
  const esCliente = !!cargo.clienteId;
  const pendienteCargo = cargo.pendiente ?? cargo.importe;

  // Un cobro ya usado por completo no se ofrece, aunque llegue en la lista.
  const pagos = useMemo(
    () => pagosDisponibles.filter((p) => disponiblePago(p) > EPS),
    [pagosDisponibles],
  );
  const sugeridoPara = (p: MovimientoCc | undefined) =>
    p ? Math.min(pendienteCargo, disponiblePago(p)) : pendienteCargo;

  const [modo, setModo] = useState<Modo>(pagos.length > 0 ? 'existente' : 'nuevo');

  // Modo "existente": elegir un pago ya cargado y cuánto imputarle.
  const [pagoId, setPagoId] = useState(pagos[0]?.id ?? '');
  const [importeStr, setImporteStr] = useState(() => formatCurrencyArFromNumber(sugeridoPara(pagos[0])));
  const pagoSeleccionado = useMemo(() => pagos.find((p) => p.id === pagoId) ?? null, [pagos, pagoId]);
  const disponibleSeleccionado = pagoSeleccionado ? disponiblePago(pagoSeleccionado) : 0;
  const importeIngresado = parseCurrencyAr(importeStr) ?? 0;

  // Segundo cobro opcional ('' = ninguno). Con dos, el reparto sigue la regla fija
  // (primero el de menor disponible) y no se ingresa importe a mano.
  const [pagoId2, setPagoId2] = useState('');
  const pagoSeleccionado2 = useMemo(
    () => (pagoId2 ? (pagos.find((p) => p.id === pagoId2) ?? null) : null),
    [pagos, pagoId2],
  );
  const reparto = useMemo(() => {
    if (!pagoSeleccionado || !pagoSeleccionado2) return null;
    const elegidos = [pagoSeleccionado, pagoSeleccionado2];
    return repartirImputacion(
      pendienteCargo,
      elegidos.map((p) => ({
        id: p.id,
        disponible: disponiblePago(p),
        fecha: p.fecha,
        createdAt: p.createdAt,
      })),
    ).map((r) => {
      const pago = elegidos.find((p) => p.id === r.pagoId)!;
      return { ...r, pago, queda: Math.max(0, disponiblePago(pago) - r.importe) };
    });
  }, [pagoSeleccionado, pagoSeleccionado2, pendienteCargo]);
  const totalReparto = reparto ? reparto.reduce((s, r) => s + r.importe, 0) : 0;

  function elegirPago(id: string) {
    setPagoId(id);
    if (id === pagoId2) setPagoId2('');
    setImporteStr(formatCurrencyArFromNumber(sugeridoPara(pagos.find((p) => p.id === id))));
  }

  // Modo "nuevo": cargar el cobro/pago ahí mismo y aplicarlo de una.
  const [nuevoImporteStr, setNuevoImporteStr] = useState(() => formatCurrencyArFromNumber(pendienteCargo));
  const [nuevaFecha, setNuevaFecha] = useState(() => hoyArgentinaIso());
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
      if (pagoId2) {
        if (pagoId2 === pagoId) {
          setError(`No se puede elegir el mismo ${esCliente ? 'cobro' : 'pago'} dos veces.`);
          return;
        }
        setSaving(true);
        try {
          await crearImputacionMultiple(() => getToken(), {
            cargoId: cargo.id,
            pagoIds: [pagoId, pagoId2],
          });
          onDone();
          onClose();
        } catch (err) {
          setError(friendlyError(err, 'cuentaCorriente'));
        } finally {
          setSaving(false);
        }
        return;
      }
      const importe = parseCurrencyAr(importeStr);
      if (!importe || importe <= 0) {
        setError('Ingresá un importe mayor a 0.');
        return;
      }
      if (importe > disponibleSeleccionado + EPS) {
        setError(
          `El importe supera lo disponible ${esCliente ? 'del cobro' : 'del pago'} (${formatCurrencyArFromNumber(disponibleSeleccionado)} ${pagoSeleccionado?.moneda ?? cargo.moneda}).`,
        );
        return;
      }
      if (importe > pendienteCargo + EPS) {
        setError(
          `El importe supera lo que falta ${esCliente ? 'cobrar' : 'pagar'} (${formatCurrencyArFromNumber(pendienteCargo)} ${cargo.moneda}).`,
        );
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
            disabled={saving || (modo === 'existente' && pagos.length === 0)}
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
            ? fmtDateUtc(cargo.fechaVencimiento)
            : 'sin fecha configurada'}
          .
        </p>

        {pagos.length > 0 && (
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
                {esCliente ? 'Cobro' : 'Pago'} a imputar <span className="text-red-500">*</span>
              </label>
              <select
                id="cc-pago-select"
                className={inputClass}
                value={pagoId}
                onChange={(e) => elegirPago(e.target.value)}
              >
                {pagos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaPago(p)}
                  </option>
                ))}
              </select>
            </div>

            {pagos.length > 1 && (
              <div>
                <label className={labelClass} htmlFor="cc-pago-select-2">
                  Segundo {esCliente ? 'cobro' : 'pago'}
                </label>
                <select
                  id="cc-pago-select-2"
                  className={inputClass}
                  value={pagoId2}
                  onChange={(e) => setPagoId2(e.target.value)}
                >
                  <option value="">Ninguno</option>
                  {pagos
                    .filter((p) => p.id !== pagoId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiquetaPago(p)}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {reparto ? (
              <div className="border border-black/10 bg-vialto-mist/50 p-3 text-sm">
                <p className="mb-2 text-xs uppercase tracking-wider text-vialto-steel">
                  Resumen de la imputación
                </p>
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="text-left text-vialto-steel">
                      <th className="pb-1 font-normal">{esCliente ? 'Cobro' : 'Pago'}</th>
                      <th className="pb-1 text-right font-normal">Disponible</th>
                      <th className="pb-1 text-right font-normal">Se toma</th>
                      <th className="pb-1 text-right font-normal">Queda disponible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reparto.map((r) => (
                      <tr key={r.pagoId}>
                        <td className="py-0.5">
                          {fmtDateUtc(r.pago.fecha)}
                          {r.pago.concepto ? ` (${r.pago.concepto})` : ''}
                        </td>
                        <td className="py-0.5 text-right">
                          {formatCurrencyArFromNumber(disponiblePago(r.pago))}
                        </td>
                        <td className="py-0.5 text-right font-medium">
                          {formatCurrencyArFromNumber(r.importe)}
                        </td>
                        <td className="py-0.5 text-right">{formatCurrencyArFromNumber(r.queda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-vialto-charcoal">
                  Se imputan {formatCurrencyArFromNumber(totalReparto)} {cargo.moneda}. Queda pendiente{' '}
                  {esCliente ? 'de cobrar' : 'de pagar'}:{' '}
                  <strong>
                    {formatCurrencyArFromNumber(Math.max(0, pendienteCargo - totalReparto))} {cargo.moneda}
                  </strong>
                  .
                </p>
                {reparto.some((r) => r.importe <= EPS) && (
                  <p className="mt-1 text-xs text-amber-800/90">
                    Con el {esCliente ? 'cobro' : 'pago'} de menor disponible ya alcanza: el otro no se usa.
                  </p>
                )}
                <p className="mt-1 text-xs text-vialto-steel">
                  Se usa primero el de menor disponible; lo que sobra del otro queda a cuenta.
                </p>
              </div>
            ) : (
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
                  {esCliente ? 'Al cobro' : 'Al pago'} le quedan{' '}
                  {formatCurrencyArFromNumber(disponibleSeleccionado)} {pagoSeleccionado.moneda} disponibles
                  {Math.abs(disponibleSeleccionado - pagoSeleccionado.importe) > EPS &&
                    ` de ${formatCurrencyArFromNumber(pagoSeleccionado.importe)} ${pagoSeleccionado.moneda}`}
                  .
                  {importeIngresado > EPS &&
                    importeIngresado < disponibleSeleccionado - EPS &&
                    ` El sobrante (${formatCurrencyArFromNumber(disponibleSeleccionado - importeIngresado)} ${pagoSeleccionado.moneda}) queda a cuenta.`}
                  {pagoSeleccionado.moneda !== cargo.moneda &&
                    ` Atención: distinta moneda que ${esCliente ? 'la venta' : 'la compra'}, el servidor lo va a rechazar.`}
                </p>
              )}
            </div>
            )}
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
                Medio de {esCliente ? 'cobro' : 'pago'} / referencia
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
