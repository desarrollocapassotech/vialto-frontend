import { useAuth } from '@clerk/clerk-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { ErrorPieModal } from '@/components/shared/ErrorPieModal';
import {
  FacturaLineasEditor,
  computeFacturaTotales,
  computeIvaPorAlicuota,
  labelIvaAlicuota,
  toFacturaLineasPayload,
  validateFacturaLineasDraft,
  type FacturaLineaDraft,
} from '@/components/facturacion/FacturaLineasEditor';
import {
  formatCurrencyArFromNumber,
  maskCurrencyArInput,
  parseCurrencyAr,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import { fechaDiaYmd, fmtDateUtc } from '@/lib/fmtDateUtc';
import { friendlyError } from '@/lib/friendlyError';
import { useToast } from '@/lib/toast';
import { useConfirmarDescarte } from '@/hooks/useConfirmarDescarte';
import {
  actualizarMovimiento,
  claseMontoCobroPago,
  estadoMovimientoCcLabel,
  type MovimientoCc,
} from '@/lib/cuentaCorriente';
import { imputacionesDeCargo } from './ImputacionesCargoModal';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

/** IVA con el que arranca una línea nueva, igual que al crear la venta/compra. */
const IVA_PCT_DEFAULT = 21;

type Props = {
  movimiento: MovimientoCc;
  /** Movimientos de la cuenta: de acá salen las imputaciones. */
  movimientos: MovimientoCc[];
  onClose: () => void;
  /** Después de guardar: recargar la grilla. */
  onSaved: () => void;
  /**
   * Factura/liquidación (no manual): su edición es la de siempre (número y vencimiento,
   * `ComprobanteCcModal`). Null = no se puede editar nada.
   */
  onEditarAutomatico: (() => void) | null;
  /** Abre el detalle de un comprobante asociado (el cobro de una venta, la venta de un cobro). */
  onVerMovimiento: (m: MovimientoCc) => void;
};

const monto = (n: number, moneda: string) => `$ ${formatCurrencyArFromNumber(n)} ${moneda}`;

/** Nombre del movimiento para el título y el botón: venta / compra / cobro / pago. */
export function nombreMovimientoCc(m: MovimientoCc): string {
  if (m.tipo === 'pago') return m.clienteId ? 'cobro' : 'pago';
  return m.clienteId ? 'venta' : 'compra';
}

/** Líneas para editar: las guardadas o, en una venta/compra vieja, una sola con su importe e IVA. */
function lineasIniciales(m: MovimientoCc): FacturaLineaDraft[] {
  if (m.lineas?.length) {
    return m.lineas.map((l) => ({ descripcion: l.descripcion, importe: l.importe, ivaPct: l.ivaPct }));
  }
  return [
    {
      descripcion: m.concepto,
      importe: m.importeNeto ?? m.importe,
      ivaPct: m.ivaPct ?? 0,
    },
  ];
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-vialto-steel">{label}</dt>
      <dd className="truncate text-sm text-vialto-charcoal">{children}</dd>
    </div>
  );
}

/**
 * Detalle de una venta/compra/cobro/pago con todos sus datos y, si es manual, edición de
 * todo: comprobante, fechas, medio de cobro, moneda e importe/líneas (estos dos últimos
 * solo sin imputaciones, porque cambiarían saldos ya imputados).
 */
export function MovimientoCcDetalleModal({
  movimiento: m,
  movimientos,
  onClose,
  onSaved,
  onEditarAutomatico,
  onVerMovimiento,
}: Props) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const nombre = nombreMovimientoCc(m);
  const esCargo = m.tipo === 'cargo';
  const esCliente = !!m.clienteId;
  const manual = m.origen === 'manual';
  const anulado = m.estadoDisponibilidad === 'anulado';
  const porId = new Map(movimientos.map((x) => [x.id, x]));

  // Imputaciones: de la venta/compra (qué cobros la cancelan) o del cobro/pago (a qué ventas fue).
  const imputaciones = esCargo
    ? imputacionesDeCargo(m, movimientos).map(({ pago, importe }) => ({ otro: pago, importe }))
    : (m.imputacionesPorCargo ?? []).map((i) => ({ otro: porId.get(i.cargoId) ?? null, importe: i.importe }));
  const tieneImputaciones = imputaciones.length > 0;
  const editable = manual && !anulado;
  const puedeEditar = editable || !!onEditarAutomatico;

  const [editando, setEditando] = useState(false);
  const [numero, setNumero] = useState(m.numeroComprobante ?? '');
  const [fecha, setFecha] = useState(fechaDiaYmd(m.fecha) ?? '');
  const [vencimiento, setVencimiento] = useState(fechaDiaYmd(m.fechaVencimiento) ?? '');
  const [moneda, setMoneda] = useState<ViajeMonedaCodigo>(m.moneda as ViajeMonedaCodigo);
  const [importeStr, setImporteStr] = useState(formatCurrencyArFromNumber(m.importe));
  const [formaPago, setFormaPago] = useState(m.referencia ?? '');
  const [lineas, setLineas] = useState<FacturaLineaDraft[]>(() => lineasIniciales(m));
  const [lineasIncompletas, setLineasIncompletas] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cerrar/cancelar con cambios sin guardar pide confirmación y cierra todo (no vuelve a "Ver").
  // Guardia solo en modo editar (regla de CLAUDE.md: ver + editar en el mismo modal).
  const descarte = useConfirmarDescarte(onClose, editando);

  // Detalle de importes para ver: líneas guardadas, o el neto + IVA de la carga vieja.
  const lineasVista = m.lineas?.length ? lineasIniciales(m) : null;
  const totalesVista = lineasVista ? computeFacturaTotales(lineasVista, IVA_PCT_DEFAULT) : null;
  const ivaVista = lineasVista ? computeIvaPorAlicuota(lineasVista, IVA_PCT_DEFAULT) : [];

  function editar() {
    if (!editable) {
      onEditarAutomatico?.();
      return;
    }
    setEditando(true);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!numero.trim()) {
      setError('Ingresá el número de comprobante.');
      return;
    }
    if (!fecha) {
      setError('Ingresá la fecha de emisión.');
      return;
    }
    let importe: number | undefined;
    if (!tieneImputaciones) {
      if (esCargo) {
        const v = validateFacturaLineasDraft(lineas);
        if (!v.ok) {
          setLineasIncompletas(v.indices);
          setError(v.message);
          return;
        }
      } else {
        importe = parseCurrencyAr(importeStr);
        if (!importe || importe <= 0) {
          setError('Ingresá un importe mayor a 0.');
          return;
        }
      }
    }
    setSaving(true);
    setError(null);
    try {
      await actualizarMovimiento(() => getToken(), m.id, {
        numeroComprobante: numero.trim(),
        fecha,
        ...(esCargo ? { fechaVencimiento: vencimiento || null } : { formaPago: formaPago.trim() }),
        // Lo que mueve plata, solo sin imputaciones.
        ...(tieneImputaciones
          ? {}
          : esCargo
            ? {
                moneda,
                lineas: toFacturaLineasPayload(lineas).map((l) => ({
                  descripcion: l.descripcion,
                  importe: l.importe,
                  ivaPct: l.ivaPct ?? IVA_PCT_DEFAULT,
                })),
              }
            : { moneda, importe }),
      });
      // Venta/compra en femenino, cobro/pago en masculino.
      showToast(
        `${nombre[0].toUpperCase()}${nombre.slice(1)} actualizad${esCargo ? 'a' : 'o'}.`,
        'success',
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(friendlyError(err, 'cuentaCorriente'));
    } finally {
      setSaving(false);
    }
  }

  // El número va siempre en el título (por eso no se repite en la franja de datos).
  const titulo = `${editando ? 'Editar' : 'Ver'} ${nombre} — ${m.numeroComprobante?.trim() || 'sin comprobante'}`;
  const tipoNoObvio = !['VENTA', 'COMPRA', 'COBRO', 'PAGO'].includes(m.concepto);

  return (
    <ViewModalShell
      title={titulo}
      onClose={descarte.solicitarCierre}
      descarte={descarte}
      maxWidthClass={esCargo ? 'sm:max-w-5xl' : 'sm:max-w-3xl'}
      scrollBody
      footer={
        editando ? (
          <>
            <ErrorPieModal error={error} />
            <button type="button" className={viewModalBtnGhost} onClick={descarte.solicitarCierre}>
              Cancelar
            </button>
            <button type="submit" form="detalle-cc-form" className={viewModalBtnPrimary} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={viewModalBtnGhost} onClick={onClose}>
              Cerrar
            </button>
            {puedeEditar && (
              <button type="button" className={viewModalBtnPrimary} onClick={editar}>
                Editar
              </button>
            )}
          </>
        )
      }
    >
      {editando ? (
        <form id="detalle-cc-form" onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
            <div>
              <label className={labelClass} htmlFor="det-numero">
                Número de comprobante <span className="text-red-500">*</span>
              </label>
              <input
                id="det-numero"
                type="text"
                maxLength={64}
                className={inputClass}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                required
              />
            </div>
            {esCargo ? (
              <div>
                <label className={labelClass} htmlFor="det-fecha">
                  Fecha de emisión
                </label>
                <input
                  id="det-fecha"
                  type="date"
                  className={inputClass}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div>
                <label className={labelClass} htmlFor="det-importe">
                  Importe
                </label>
                <input
                  id="det-importe"
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  value={importeStr}
                  onChange={(e) => setImporteStr(maskCurrencyArInput(e.target.value))}
                  disabled={tieneImputaciones}
                  required
                />
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="det-moneda">
                Moneda
              </label>
              <MonedaSelect
                id="det-moneda"
                value={moneda}
                onChange={setMoneda}
                className={inputClass}
                disabled={tieneImputaciones}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {esCargo ? (
              <div>
                <label className={labelClass} htmlFor="det-vencimiento">
                  Vencimiento
                </label>
                <input
                  id="det-vencimiento"
                  type="date"
                  className={inputClass}
                  value={vencimiento}
                  onChange={(e) => setVencimiento(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass} htmlFor="det-fecha">
                    Fecha de emisión
                  </label>
                  <input
                    id="det-fecha"
                    type="date"
                    className={inputClass}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="det-forma-pago">
                    Medio de {esCliente ? 'cobro' : 'pago'} / referencia
                  </label>
                  <input
                    id="det-forma-pago"
                    type="text"
                    className={inputClass}
                    value={formaPago}
                    onChange={(e) => setFormaPago(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

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
              disabled={tieneImputaciones}
              agregarAbajo
              totalesALaDerecha
              labelImporte="Importe"
              mostrarSubtotal
            />
          )}

          {tieneImputaciones && (
            <p className="text-xs text-vialto-steel">
              Tiene imputaciones: el importe y la moneda no se pueden cambiar. El resto sí.
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-5">
          {/* Franja compacta (mismo estilo que el resumen de "Imputar cobro"). El comprobante va
              en el título; el tipo solo si no es el obvio (ej. FACTURA A, LIQUIDACION). */}
          <dl className="grid grid-cols-2 border border-black/10 bg-vialto-mist/40 sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none sm:divide-x sm:divide-black/10">
            {tipoNoObvio && <Dato label="Tipo">{m.concepto}</Dato>}
            <Dato label="Emisión">{fmtDateUtc(m.fecha)}</Dato>
            {esCargo ? (
              <Dato label="Vencimiento">{m.fechaVencimiento ? fmtDateUtc(m.fechaVencimiento) : '—'}</Dato>
            ) : (
              <Dato label={`Medio de ${esCliente ? 'cobro' : 'pago'}`}>{m.referencia?.trim() || '—'}</Dato>
            )}
            <Dato label="Moneda">{m.moneda}</Dato>
            <Dato label="Estado">{estadoMovimientoCcLabel(m)}</Dato>
          </dl>

          {esCargo && lineasVista && (
            <div className="overflow-x-auto border border-black/10">
              <table className="w-full text-sm">
                <thead className="bg-vialto-mist/50 text-left text-[11px] uppercase tracking-wider text-vialto-steel">
                  <tr>
                    <th className="px-3 py-2 font-normal">Descripción</th>
                    <th className="px-3 py-2 text-right font-normal">Importe</th>
                    <th className="px-3 py-2 text-right font-normal">IVA %</th>
                    <th className="px-3 py-2 text-right font-normal">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 tabular-nums">
                  {lineasVista.map((l, i) => {
                    const iva = Math.round(((l.importe * (l.ivaPct ?? 0)) / 100) * 100) / 100;
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2">{l.descripcion}</td>
                        <td className="px-3 py-2 text-right">{monto(l.importe, m.moneda)}</td>
                        <td className="px-3 py-2 text-right">
                          {(l.ivaPct ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%
                        </td>
                        <td className="px-3 py-2 text-right">{monto(l.importe + iva, m.moneda)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Totales a la derecha, igual que al cargarla. */}
          <div className="space-y-1 text-right text-xs text-vialto-steel">
            {totalesVista ? (
              <>
                <p>
                  Subtotal: <span className="font-medium tabular-nums text-vialto-charcoal">{monto(totalesVista.neto, m.moneda)}</span>
                </p>
                {ivaVista.map(({ pct, iva }) => (
                  <p key={pct}>
                    {labelIvaAlicuota(pct)}:{' '}
                    <span className="font-medium tabular-nums text-vialto-charcoal">{monto(iva, m.moneda)}</span>
                  </p>
                ))}
              </>
            ) : (
              m.importeNeto != null && (
                <>
                  <p>
                    Subtotal: <span className="font-medium tabular-nums text-vialto-charcoal">{monto(m.importeNeto, m.moneda)}</span>
                  </p>
                  <p>
                    {m.ivaPct != null ? labelIvaAlicuota(m.ivaPct) : 'IVA'}:{' '}
                    <span className="font-medium tabular-nums text-vialto-charcoal">{monto(m.ivaMonto ?? 0, m.moneda)}</span>
                  </p>
                </>
              )
            )}
            <p className="text-sm">
              Total:{' '}
              <span
                className={`font-semibold tabular-nums ${
                  esCargo ? 'text-vialto-charcoal' : claseMontoCobroPago(esCliente)
                }`}
              >
                {monto(m.importe, m.moneda)}
              </span>
            </p>
            {m.pendiente != null && m.tipo !== 'credito' && (
              <p>
                {esCargo ? (esCliente ? 'Falta cobrar' : 'Falta pagar') : 'Sin imputar'}:{' '}
                <span className={`font-medium tabular-nums ${m.pendiente > 0.005 ? 'text-vialto-fire' : 'text-vialto-charcoal'}`}>
                  {monto(m.pendiente, m.moneda)}
                </span>
              </p>
            )}
          </div>

          {tieneImputaciones && (
            <section>
              <p className="mb-1 text-xs uppercase tracking-wider text-vialto-steel">
                {esCargo ? `${esCliente ? 'Cobros' : 'Pagos'} imputados` : 'Imputado a'}
              </p>
              <ul className="divide-y divide-black/10 border border-black/10">
                {imputaciones.map(({ otro, importe }, i) => {
                  const contenido = (
                    <>
                      <span className="min-w-0 flex-1 truncate">
                        <span className={otro?.numeroComprobante?.trim() ? 'font-medium' : 'italic text-vialto-steel'}>
                          {otro?.numeroComprobante?.trim() || 'Sin comprobante'}
                        </span>
                        {otro && (
                          <span className="ml-2 text-xs text-vialto-steel">
                            {otro.concepto} · {fmtDateUtc(otro.fecha)}
                          </span>
                        )}
                      </span>
                      {/* El monto imputado es plata de un cobro (verde) o de un pago (rojo). */}
                      <span className={`shrink-0 tabular-nums ${claseMontoCobroPago(esCliente)}`}>
                        {monto(importe, m.moneda)}
                      </span>
                      {otro && <ChevronRight className="h-4 w-4 shrink-0 text-vialto-steel" aria-hidden />}
                    </>
                  );
                  return (
                    <li key={otro?.id ?? i}>
                      {/* Tocar el comprobante asociado abre su detalle. */}
                      {otro ? (
                        <button
                          type="button"
                          onClick={() => onVerMovimiento(otro)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-vialto-mist"
                          title={`Ver ${nombreMovimientoCc(otro)}`}
                        >
                          {contenido}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-3 py-2 text-sm">{contenido}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!manual && (
            <p className="text-xs text-vialto-steel">
              Generado desde {m.origen === 'liquidacion' ? 'Liquidaciones' : m.origen === 'factura' ? 'Facturas' : 'otro módulo'}: desde acá solo se editan el número y el vencimiento.
            </p>
          )}
        </div>
      )}
    </ViewModalShell>
  );
}
