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
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { useToast } from '@/lib/toast';
import { useConfirmarDescarte } from '@/hooks/useConfirmarDescarte';

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

/** Comprobante del cobro/pago (recibo, orden de pago); los viejos pueden no tenerlo. */
function comprobantePago(p: MovimientoCc): string {
  return p.numeroComprobante?.trim() || 'Sin comprobante';
}

function etiquetaPago(p: MovimientoCc): string {
  const disponible = disponiblePago(p);
  const usado = Math.abs(disponible - p.importe) > EPS;
  return (
    `${comprobantePago(p)} — ${fmtDateUtc(p.fecha)} — ${formatCurrencyArFromNumber(disponible)} ${p.moneda}` +
    (usado ? ` disponibles de ${formatCurrencyArFromNumber(p.importe)} ${p.moneda}` : '')
  );
}

/** Filtro de los selects: por el texto que se ve (comprobante, fecha, importe). */
function filtrarPagos(items: MovimientoCc[], query: string): MovimientoCc[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((p) => etiquetaPago(p).toLowerCase().includes(q));
}

export function ImputarPagoModal({ cargo, pagosDisponibles, onClose, onDone }: Props) {
  const { getToken } = useAuth();
  const esCliente = !!cargo.clienteId;
  const pendienteCargo = cargo.pendiente ?? cargo.importe;
  // Vencimiento = medianoche UTC del día: se compara el día contra hoy en Argentina.
  const vencido =
    !!cargo.fechaVencimiento && cargo.fechaVencimiento.slice(0, 10) < hoyArgentinaIso();

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

  // Con un cobro que cubre todo lo pendiente no hace falta un segundo.
  const primeroAlcanza = !!pagoSeleccionado && disponiblePago(pagoSeleccionado) >= pendienteCargo - EPS;

  function elegirPago(id: string) {
    setPagoId(id);
    const nuevo = pagos.find((p) => p.id === id);
    if (id === pagoId2 || (nuevo && disponiblePago(nuevo) >= pendienteCargo - EPS)) setPagoId2('');
    setImporteStr(formatCurrencyArFromNumber(sugeridoPara(pagos.find((p) => p.id === id))));
  }

  // Modo "nuevo": cargar el cobro/pago ahí mismo y aplicarlo de una.
  const [nuevoImporteStr, setNuevoImporteStr] = useState(() => formatCurrencyArFromNumber(pendienteCargo));
  const [nuevaFecha, setNuevaFecha] = useState(() => hoyArgentinaIso());
  const [nuevaFormaPago, setNuevaFormaPago] = useState('');
  const [nuevoComprobante, setNuevoComprobante] = useState('');

  const [saving, setSaving] = useState(false);
  const descarte = useConfirmarDescarte(onClose);
  const { showToast } = useToast();

  /** Aviso de éxito: imputar no agrega filas a la grilla, así que sin esto no se nota. */
  function avisarImputado(importe: number, nuevo = false) {
    const que = esCliente ? 'Cobro' : 'Pago';
    const destino = cargo.numeroComprobante?.trim()
      ? ` ${cargo.numeroComprobante.trim()}`
      : '';
    showToast(
      `${que} ${nuevo ? 'registrado e imputado' : 'imputado'}: $ ${formatCurrencyArFromNumber(importe)} ${cargo.moneda} a la ${esCliente ? 'venta' : 'compra'}${destino}.`,
      'success',
    );
  }
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
          avisarImputado(totalReparto);
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
      // Un importe mayor no se rechaza: se imputa hasta lo que falta de la venta/compra y
      // hasta lo disponible del cobro/pago. Lo que sobra del cobro queda sin imputar; lo
      // que falta de la venta queda pendiente.
      const aImputar = Math.min(importe, pendienteCargo, disponibleSeleccionado);
      setSaving(true);
      try {
        await crearImputacion(() => getToken(), { pagoId, cargoId: cargo.id, importe: aImputar });
        avisarImputado(aImputar);
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
    if (!nuevoComprobante.trim()) {
      setError(`Ingresá el número de comprobante ${esCliente ? 'del cobro' : 'del pago'}.`);
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
        numeroComprobante: nuevoComprobante.trim(),
        formaPago: nuevaFormaPago.trim() || undefined,
      });
      await crearImputacion(() => getToken(), {
        pagoId: pagoCreado.id,
        cargoId: cargo.id,
        importe: Math.min(importeNuevo, pendienteCargo),
      });
      avisarImputado(Math.min(importeNuevo, pendienteCargo), true);
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
      // Al lado del título, el comprobante de la venta/compra que se imputa.
      title={`${esCliente ? 'Imputar cobro' : 'Imputar pago'}${
        cargo.numeroComprobante?.trim() ? ` — ${cargo.numeroComprobante.trim()}` : ''
      }`}
      onClose={descarte.solicitarCierre}
      descarte={descarte}
      footer={
        <>
          <ErrorPieModal error={error} />
          <button type="button" className={viewModalBtnGhost} onClick={descarte.solicitarCierre}>
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
        {/* Resumen de la venta/compra: total, lo que falta y el vencimiento (en rojo si ya pasó). */}
        <dl className="grid grid-cols-3 divide-x divide-black/10 border border-black/10 bg-vialto-mist/40 text-sm">
          <div className="px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wider text-vialto-steel">Total</dt>
            <dd className="tabular-nums text-vialto-charcoal">
              $ {formatCurrencyArFromNumber(cargo.importe)} {cargo.moneda}
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wider text-vialto-steel">
              {esCliente ? 'Falta cobrar' : 'Falta pagar'}
            </dt>
            <dd className="font-semibold tabular-nums text-vialto-charcoal">
              $ {formatCurrencyArFromNumber(pendienteCargo)} {cargo.moneda}
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wider text-vialto-steel">Vence</dt>
            <dd className={vencido ? 'font-semibold text-red-700' : 'text-vialto-charcoal'}>
              {cargo.fechaVencimiento ? fmtDateUtc(cargo.fechaVencimiento) : '—'}
              {vencido && <span className="ml-1 text-xs font-normal">(vencida)</span>}
            </dd>
          </div>
        </dl>

        {pagos.length > 0 && (
          // Pestañas con el mismo estilo que las secciones de Mantenimiento.
          <div className="border-b border-black/15">
            <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
              {(
                [
                  { id: 'existente', label: 'Existente' },
                  { id: 'nuevo', label: 'Nuevo' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={modo === tab.id}
                  onClick={() => setModo(tab.id)}
                  className={[
                    'flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border',
                    modo === tab.id
                      ? 'border-black/15 border-t-2 border-t-vialto-fire border-b-white bg-white text-vialto-charcoal'
                      : 'border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {modo === 'existente' ? (
          <>
            <div>
              <label className={labelClass} htmlFor="cc-pago-select">
                {esCliente ? 'Cobro' : 'Pago'} a imputar <span className="text-red-500">*</span>
              </label>
              <SearchableEntitySelect
                id="cc-pago-select"
                items={pagos}
                value={pagoId}
                onChange={elegirPago}
                filterItems={filtrarPagos}
                getPrimaryLabel={etiquetaPago}
                inputClassName={inputClass}
                placeholderBuscar="Buscar por comprobante, fecha o importe…"
                aria-label={`${esCliente ? 'Cobro' : 'Pago'} a imputar`}
              />
            </div>

            {/* Segundo cobro solo si el primero no alcanza para cancelar lo pendiente. */}
            {pagos.length > 1 && !primeroAlcanza && (
              <div>
                <label className={labelClass} htmlFor="cc-pago-select-2">
                  Segundo {esCliente ? 'cobro' : 'pago'}
                </label>
                <SearchableEntitySelect
                  id="cc-pago-select-2"
                  items={pagos.filter((p) => p.id !== pagoId)}
                  value={pagoId2}
                  onChange={setPagoId2}
                  filterItems={filtrarPagos}
                  getPrimaryLabel={etiquetaPago}
                  inputClassName={inputClass}
                  allowEmptyValue
                  emptyListChoiceLabel="Ninguno"
                  placeholderCerrado="Ninguno"
                  placeholderBuscar="Buscar por comprobante, fecha o importe…"
                  aria-label={`Segundo ${esCliente ? 'cobro' : 'pago'}`}
                />
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
                          {comprobantePago(r.pago)} — {fmtDateUtc(r.pago.fecha)}
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
            </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className={labelClass} htmlFor="cc-nuevo-comprobante">
                Número de comprobante <span className="text-red-500">*</span>
              </label>
              <input
                id="cc-nuevo-comprobante"
                type="text"
                maxLength={64}
                className={inputClass}
                value={nuevoComprobante}
                onChange={(e) => setNuevoComprobante(e.target.value)}
                placeholder={esCliente ? 'Ej. Recibo 0001-00000123' : 'Ej. Orden de pago 0001-00000123'}
                required
              />
            </div>
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
          </>
        )}

      </form>
    </ViewModalShell>
  );
}
