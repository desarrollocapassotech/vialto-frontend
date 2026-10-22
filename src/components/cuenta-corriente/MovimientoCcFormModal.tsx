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
import {
  FacturaLineasEditor,
  toFacturaLineasPayload,
  validateFacturaLineasDraft,
  type FacturaLineaDraft,
} from '@/components/facturacion/FacturaLineasEditor';
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { useConfirmarDescarte } from '@/hooks/useConfirmarDescarte';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

/** IVA con el que arranca cada línea de una venta/compra, igual que en Facturas. */
const IVA_PCT_DEFAULT = 21;

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
  // Fijo según el botón que abrió el modal (Nueva venta/compra o Registrar cobro/pago).
  const tipo: TipoMovimientoCc = permiteCargo ? tipoInicial : 'pago';
  const [importeStr, setImporteStr] = useState('');
  // Venta/compra: líneas como en una factura, cada una con su importe neto e IVA.
  const [lineas, setLineas] = useState<FacturaLineaDraft[]>([
    { descripcion: '', importe: 0, importeStr: '', ivaPct: IVA_PCT_DEFAULT },
  ]);
  const [lineasIncompletas, setLineasIncompletas] = useState<number[]>([]);
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
  // Solo los de la moneda del cobro/pago: no se imputa entre monedas.
  const opcionesImputar = cargosPendientes.filter((c) => c.moneda === moneda).sort(porAntiguedad);
  const elegidos = opcionesImputar.filter((c) => imputarA.includes(c.id));
  const totalElegido = elegidos.reduce((s, c) => s + (c.pendiente ?? c.importe), 0);
  // Filtro de la lista por lo que se ve (concepto, comprobante, fecha, importes). Lo elegido
  // se conserva aunque quede oculto por el filtro.
  const [filtroCargos, setFiltroCargos] = useState('');
  const opcionesFiltradas = (() => {
    const q = filtroCargos.trim().toLowerCase();
    if (!q) return opcionesImputar;
    return opcionesImputar.filter((c) =>
      [
        c.concepto,
        c.numeroComprobante ?? '',
        fmtDateUtc(c.fecha),
        formatCurrencyArFromNumber(c.pendiente ?? c.importe),
        formatCurrencyArFromNumber(c.importe),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  })();

  /** Recalcula el importe a cobrar con la suma de lo elegido (después se puede editar). */
  function cambiarImputacion(ids: string[]) {
    setImputarA(ids);
    const nuevos = opcionesImputar.filter((c) => ids.includes(c.id));
    if (nuevos.length === 0) return;
    const suma = nuevos.reduce((s, c) => s + (c.pendiente ?? c.importe), 0);
    setImporteStr(formatCurrencyArFromNumber(suma));
  }

  function toggleCargo(id: string) {
    cambiarImputacion(imputarA.includes(id) ? imputarA.filter((x) => x !== id) : [...imputarA, id]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Venta/compra: el total (neto + IVA de cada línea) lo calcula el backend igual que el pie del editor.
    const importe = esCargo ? undefined : parseCurrencyAr(importeStr);
    // Todo movimiento manual (venta, compra, cobro, pago) se identifica por su comprobante.
    if (!numeroComprobante.trim()) {
      setError('Ingresá el número de comprobante.');
      return;
    }
    if (esCargo) {
      const v = validateFacturaLineasDraft(lineas);
      if (!v.ok) {
        setLineasIncompletas(v.indices);
        setError(v.message);
        return;
      }
      setLineasIncompletas([]);
      if (lineas.some((l) => (l.ivaPct ?? IVA_PCT_DEFAULT) < 0 || (l.ivaPct ?? IVA_PCT_DEFAULT) > 100)) {
        setError('El IVA tiene que ser un porcentaje entre 0 y 100.');
        return;
      }
    } else if (!importe || importe <= 0) {
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
        // Sin `concepto`: el backend lo pone solo (VENTA/COMPRA/COBRO/PAGO).
        imputarACargoIds: !esCargo && imputarA.length > 0 ? imputarA : undefined,
        importe,
        lineas: esCargo
          ? toFacturaLineasPayload(lineas).map((l) => ({
              descripcion: l.descripcion,
              importe: l.importe,
              ivaPct: l.ivaPct ?? IVA_PCT_DEFAULT,
            }))
          : undefined,
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

  // Va junto al medio de cobro (cobro/pago) o junto al vencimiento (venta/compra).
  const campoFecha = (
    <div>
      <label className={labelClass} htmlFor="cc-fecha">
        {esCargo ? 'Emisión' : 'Fecha de emisión'}
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
      // Más ancho y alto: líneas de la venta/compra o lista de facturas a imputar del cobro/pago.
      maxWidthClass={esCargo ? 'sm:max-w-5xl' : 'sm:max-w-3xl'}
      scrollBody
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
        {/* Venta/compra: número de comprobante y moneda primero, debajo emisión y vencimiento. */}
        {esCargo ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="cc-comprobante">
                  Número de comprobante <span className="text-red-500">*</span>
                </label>
                <input
                  id="cc-comprobante"
                  type="text"
                  maxLength={64}
                  className={inputClass}
                  value={numeroComprobante}
                  onChange={(e) => setNumeroComprobante(e.target.value)}
                  placeholder="Ej. 0001-00001234"
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
          </>
        ) : (
          <>
          {/* Cobro/pago: comprobante, importe y moneda arriba; debajo emisión y medio de cobro. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
            {/* Comprobante propio del cobro/pago (recibo, orden de pago): es lo que muestra la grilla. */}
            <div>
              <label className={labelClass} htmlFor="cc-comprobante-pago">
                Número de comprobante <span className="text-red-500">*</span>
              </label>
              <input
                id="cc-comprobante-pago"
                type="text"
                maxLength={64}
                className={inputClass}
                value={numeroComprobante}
                onChange={(e) => setNumeroComprobante(e.target.value)}
                placeholder={esCliente ? 'Ej. Recibo 0001-00000123' : 'Ej. Orden de pago 0001-00000123'}
                required
              />
            </div>
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
              {/* La moneda filtra los comprobantes a imputar: al cambiarla se desmarcan los elegidos. */}
              <MonedaSelect
                id="cc-moneda"
                value={moneda}
                onChange={(m) => {
                  setMoneda(m);
                  setImputarA([]);
                }}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {campoFecha}
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
          <fieldset>
            <legend className={labelClass}>Comprobantes sin imputar</legend>
            {opcionesImputar.length > 0 && (
              <input
                type="search"
                data-descarte-ignorar
                className={`${inputClass} mb-2`}
                value={filtroCargos}
                onChange={(e) => setFiltroCargos(e.target.value)}
                placeholder="Buscar por comprobante, fecha o importe…"
                aria-label={esCliente ? 'Filtrar facturas' : 'Filtrar liquidaciones'}
              />
            )}
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
                  No hay comprobantes en {moneda} con saldo pendiente.
                </p>
              ) : opcionesFiltradas.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-vialto-steel">Sin coincidencias.</p>
              ) : (
                opcionesFiltradas.map((c) => {
                  const checked = imputarA.includes(c.id);
                  const pendiente = c.pendiente ?? c.importe;
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-vialto-mist"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCargo(c.id)}
                      />
                      {/* Primero el número de comprobante; concepto y fecha como dato secundario. */}
                      <span className="min-w-0 flex-1 truncate">
                        <span
                          className={
                            c.numeroComprobante?.trim() ? 'font-medium' : 'italic text-vialto-steel'
                          }
                        >
                          {c.numeroComprobante?.trim() || 'Sin comprobante'}
                        </span>
                        <span className="ml-2 text-xs text-vialto-steel">
                          {c.concepto} · {fmtDateUtc(c.fecha)}
                        </span>
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
          </>
        )}

        {/* Venta/compra: el importe sale de las líneas (total = neto + IVA de cada una). */}
        {esCargo && (
          <FacturaLineasEditor
            lineas={lineas}
            onChange={(next) => {
              setLineas(next);
              setLineasIncompletas([]);
              setError(null);
            }}
            ivaPctDefault={IVA_PCT_DEFAULT}
            incompleteIndices={lineasIncompletas}
            agregarAbajo
            totalesALaDerecha
            labelImporte="Importe"
            mostrarSubtotal
          />
        )}

      </form>
    </ViewModalShell>
  );
}
