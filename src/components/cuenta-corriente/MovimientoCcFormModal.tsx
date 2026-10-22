import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";
import { useAuth } from '@clerk/clerk-react';
import { useRef, useState, type FormEvent } from 'react';
import { Info } from 'lucide-react';
import { TooltipsDelegados } from '@/components/ui/TooltipsDelegados';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { formatCurrencyArFromNumber, maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import {
  createMovimiento,
  type MovimientoCc,
  type TipoContraparte,
  type TipoMovimientoCc,
} from '@/lib/cuentaCorriente';
import { fmtDateUtc } from '@/lib/fmtDateUtc';
import type { ViajeMonedaCodigo } from '@/lib/currencyMask';
import { computeFacturaTotalesFromBases } from '@/lib/facturaTotales';
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { useConfirmarDescarte } from '@/hooks/useConfirmarDescarte';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

type Props = {
  tipoContraparte: TipoContraparte;
  contraparteId: string;
  contraparteNombre: string;
  tipoInicial?: TipoMovimientoCc;
  /**
   * Si se puede cargar una venta/compra a mano. `false` cuando la empresa tiene el módulo
   * que la genera (Facturación / Liquidaciones): el modal queda solo para cobros/pagos.
   */
  permiteCargo?: boolean;
  /** Facturas/liquidaciones con saldo pendiente de la cuenta: opciones para imputar el cobro/pago. */
  cargosPendientes?: MovimientoCc[];
  onClose: () => void;
  onCreated: () => void;
};

/** Texto del tooltip "Ver detalle" de una factura/liquidación de la lista (una línea por dato). */
function detalleCargo(c: MovimientoCc): string {
  const pendiente = c.pendiente ?? c.importe;
  const monto = (n: number) => `$ ${formatCurrencyArFromNumber(n)} ${c.moneda}`;
  return [
    `${c.concepto}${c.numeroComprobante ? ` ${c.numeroComprobante}` : ''}`,
    `Fecha: ${fmtDateUtc(c.fecha)}`,
    `Vencimiento: ${c.fechaVencimiento ? fmtDateUtc(c.fechaVencimiento) : 'sin vencimiento'}`,
    `Total: ${monto(c.importe)}`,
    `Cobrado: ${monto(c.importe - pendiente)}`,
    `Saldo: ${monto(pendiente)}`,
  ].join('\n');
}

/** Ordena del más viejo al más nuevo: mismo orden en que el backend reparte el importe. */
function porAntiguedad(a: MovimientoCc, b: MovimientoCc): number {
  const porFecha = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
  return porFecha !== 0 ? porFecha : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function MovimientoCcFormModal({
  tipoContraparte,
  contraparteId,
  contraparteNombre,
  tipoInicial = 'cargo',
  permiteCargo = true,
  cargosPendientes = [],
  onClose,
  onCreated,
}: Props) {
  const { getToken } = useAuth();
  const [tipo, setTipo] = useState<TipoMovimientoCc>(permiteCargo ? tipoInicial : 'pago');
  const [concepto, setConcepto] = useState('');
  const [importeStr, setImporteStr] = useState('');
  const [ivaPctStr, setIvaPctStr] = useState('');
  const [moneda, setMoneda] = useState<ViajeMonedaCodigo>('ARS');
  const [fecha, setFecha] = useState(() => hoyArgentinaIso());
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [saving, setSaving] = useState(false);
  const descarte = useConfirmarDescarte(onClose);
  const [error, setError] = useState<string | null>(null);

  const esCargo = tipo === 'cargo';
  const esCliente = tipoContraparte === 'cliente';

  // Cobro/pago: a qué facturas/liquidaciones imputarlo. Vacío = "No imputar" (queda a cuenta).
  const [imputarA, setImputarA] = useState<string[]>([]);
  const listaRef = useRef<HTMLDivElement>(null);
  const opcionesImputar = [...cargosPendientes].sort(porAntiguedad);
  const elegidos = opcionesImputar.filter((c) => imputarA.includes(c.id));
  const totalElegido = elegidos.reduce((s, c) => s + (c.pendiente ?? c.importe), 0);

  /** Recalcula el importe a cobrar con la suma de lo elegido (después se puede editar). */
  function cambiarImputacion(ids: string[]) {
    setImputarA(ids);
    const nuevos = opcionesImputar.filter((c) => ids.includes(c.id));
    if (nuevos.length === 0) return;
    // Las facturas elegidas fijan la moneda del cobro (no se mezclan monedas).
    setMoneda(nuevos[0].moneda as ViajeMonedaCodigo);
    const suma = nuevos.reduce((s, c) => s + (c.pendiente ?? c.importe), 0);
    setImporteStr(formatCurrencyArFromNumber(suma));
  }

  function toggleCargo(id: string) {
    cambiarImputacion(imputarA.includes(id) ? imputarA.filter((x) => x !== id) : [...imputarA, id]);
  }

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
        // El cobro/pago no lleva concepto libre: el backend pone "COBRO"/"PAGO".
        concepto: esCargo ? concepto.trim() || undefined : undefined,
        imputarACargoIds: !esCargo && imputarA.length > 0 ? imputarA : undefined,
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

  // Va junto a la moneda (cobro/pago) o junto al vencimiento (venta/compra).
  const campoFecha = (
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
  );

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
      onClose={descarte.solicitarCierre}
      descarte={descarte}
      // Cobro/pago: más ancho y alto para la lista de facturas a imputar.
      maxWidthClass={esCargo ? undefined : 'sm:max-w-3xl'}
      scrollBody={!esCargo}
      footer={
        <>
          <ErrorPieModal error={error} />
          <button type="button" className={viewModalBtnGhost} onClick={descarte.solicitarCierre}>
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
        {permiteCargo && (
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
        )}

        {esCargo ? (
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
              placeholder="Ej. Factura 0001-00001234"
            />
          </div>
        ) : (
          <fieldset>
            <legend className={labelClass}>
              {esCliente ? 'Facturas que cobra' : 'Liquidaciones que paga'}
            </legend>
            <TooltipsDelegados contenedorRef={listaRef} />
            <div
              ref={listaRef}
              className="max-h-[45vh] overflow-y-auto border border-black/15 bg-white text-sm"
            >
              <label className="flex cursor-pointer items-center gap-2 border-b border-black/10 px-2 py-1.5 hover:bg-vialto-mist">
                <input
                  type="checkbox"
                  checked={imputarA.length === 0}
                  onChange={() => cambiarImputacion([])}
                />
                <span className="font-medium uppercase tracking-wide">No imputar</span>
                <span className="text-xs text-vialto-steel">(queda a cuenta)</span>
              </label>
              {opcionesImputar.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-vialto-steel">
                  No hay {esCliente ? 'facturas' : 'liquidaciones'} con saldo pendiente.
                </p>
              ) : (
                opcionesImputar.map((c) => {
                  const checked = imputarA.includes(c.id);
                  // Una vez elegida una, solo se ofrecen las de su misma moneda.
                  const otraMoneda = elegidos.length > 0 && c.moneda !== elegidos[0].moneda;
                  const pendiente = c.pendiente ?? c.importe;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-2 py-1.5 ${
                        otraMoneda ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-vialto-mist'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={otraMoneda}
                        onChange={() => toggleCargo(c.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {c.concepto}
                        {c.numeroComprobante ? ` ${c.numeroComprobante}` : ''}
                        <span className="ml-1 text-xs text-vialto-steel">{fmtDateUtc(c.fecha)}</span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        $ {formatCurrencyArFromNumber(pendiente)} {c.moneda}
                        {pendiente < c.importe - 0.005 && (
                          <span className="block text-[11px] text-vialto-steel">
                            de $ {formatCurrencyArFromNumber(c.importe)}
                          </span>
                        )}
                      </span>
                      {/* Detalle en tooltip; no marca/desmarca la factura. */}
                      <button
                        type="button"
                        aria-label="Ver detalle"
                        title={detalleCargo(c)}
                        onClick={(e) => e.preventDefault()}
                        className="shrink-0 rounded p-0.5 text-vialto-steel/50 transition-colors hover:text-vialto-charcoal"
                      >
                        <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                      </button>
                    </label>
                  );
                })
              )}
            </div>
            {elegidos.length > 0 && (
              <p className="mt-1 text-xs text-vialto-steel tabular-nums">
                Total elegido: $ {formatCurrencyArFromNumber(totalElegido)} {elegidos[0].moneda}.
                {(parseCurrencyAr(importeStr) ?? 0) < totalElegido - 0.005
                  ? ' Se imputa de la más vieja a la más nueva; la última puede quedar parcial.'
                  : (parseCurrencyAr(importeStr) ?? 0) > totalElegido + 0.005
                    ? ' Lo que sobra queda a cuenta.'
                    : ''}
              </p>
            )}
          </fieldset>
        )}

        {/* Cobro/pago: importe, moneda y fecha en una fila; el importe toma el ancho que sobra. */}
        <div
          className={
            esCargo
              ? 'grid grid-cols-2 gap-3'
              : 'grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_10.5rem]'
          }
        >
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
            {/* Con facturas elegidas, la moneda es la de ellas. */}
            <MonedaSelect
              id="cc-moneda"
              value={moneda}
              onChange={setMoneda}
              className={inputClass}
              disabled={!esCargo && elegidos.length > 0}
            />
          </div>
          {!esCargo && campoFecha}
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

        {esCargo && (
          <div className="grid grid-cols-2 gap-3">
            {campoFecha}
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
          </div>
        )}

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
          <div className={esCliente ? '' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
            {/* Pago a proveedor: número del comprobante del pago (orden de pago, recibo). */}
            {!esCliente && (
              <div>
                <label className={labelClass} htmlFor="cc-comprobante-pago">
                  Número de comprobante
                </label>
                <input
                  id="cc-comprobante-pago"
                  type="text"
                  maxLength={64}
                  className={inputClass}
                  value={numeroComprobante}
                  onChange={(e) => setNumeroComprobante(e.target.value)}
                  placeholder="Ej. Orden de pago 0001-00000123"
                />
              </div>
            )}
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
          </div>
        )}

      </form>
    </ViewModalShell>
  );
}
