import { ChevronRight } from 'lucide-react';
import { ViewModalShell, viewModalBtnGhost } from '@/components/ui/ViewModalShell';
import { formatCurrencyArFromNumber } from '@/lib/currencyMask';
import { fmtDateUtc } from '@/lib/fmtDateUtc';
import { claseMontoCobroPago, type MovimientoCc } from '@/lib/cuentaCorriente';

type Props = {
  /** El cobro/pago imputado a varios cargos. */
  pago: MovimientoCc;
  /** Movimientos de la cuenta (de acá salen los cargos imputados). */
  movimientos: MovimientoCc[];
  /** Si se pasa, cada cargo se puede abrir (factura/liquidación). Null = no se puede ver. */
  onVerCargo?: (cargo: MovimientoCc) => (() => void) | null;
  onClose: () => void;
};

const monto = (n: number, moneda: string) => `$ ${formatCurrencyArFromNumber(n)} ${moneda}`;

/**
 * Detalle de un cobro/pago imputado a varias facturas/liquidaciones: cuánto se aplicó a
 * cada una y cuánto le queda. Tocar una abre su detalle.
 */
export function ImputacionesCobroModal({ pago, movimientos, onVerCargo, onClose }: Props) {
  const esCobro = !!pago.clienteId;
  const porId = new Map(movimientos.map((m) => [m.id, m]));
  const filas = (pago.imputacionesPorCargo ?? [])
    .map((i) => ({ ...i, cargo: porId.get(i.cargoId) ?? null }))
    .sort((a, b) =>
      a.cargo && b.cargo ? new Date(a.cargo.fecha).getTime() - new Date(b.cargo.fecha).getTime() : 0,
    );
  const totalImputado = filas.reduce((s, f) => s + f.importe, 0);
  const aCuenta = pago.importe - totalImputado;

  return (
    <ViewModalShell
      title={`${esCobro ? 'Cobro' : 'Pago'} del ${fmtDateUtc(pago.fecha)} — ${monto(pago.importe, pago.moneda)}`}
      onClose={onClose}
      maxWidthClass="sm:max-w-2xl"
      footer={
        <button type="button" className={viewModalBtnGhost} onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <p className="mb-3 text-sm text-vialto-steel">
        Se imputó a {filas.length} {esCobro ? 'facturas' : 'liquidaciones'}:
      </p>
      <ul className="divide-y divide-black/10 border border-black/10">
        {filas.map(({ cargoId, importe, cargo }) => {
          const ver = cargo && onVerCargo ? onVerCargo(cargo) : null;
          const saldo = cargo ? (cargo.pendiente ?? 0) : null;
          const contenido = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-vialto-charcoal">
                  {cargo
                    ? `${cargo.concepto}${cargo.numeroComprobante ? ` ${cargo.numeroComprobante}` : ''}`
                    : 'Comprobante no disponible'}
                </span>
                {cargo && (
                  <span className="text-xs text-vialto-steel">
                    {fmtDateUtc(cargo.fecha)} · total {monto(cargo.importe, cargo.moneda)}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block text-vialto-charcoal">
                  Imputado{' '}
                  <span className={claseMontoCobroPago(esCobro)}>{monto(importe, pago.moneda)}</span>
                </span>
                {saldo != null && (
                  <span className={`block text-xs ${saldo > 0.005 ? 'text-vialto-fire' : 'text-vialto-steel'}`}>
                    {saldo > 0.005 ? `Saldo ${monto(saldo, pago.moneda)}` : 'Sin saldo'}
                  </span>
                )}
              </span>
              {ver && <ChevronRight className="h-4 w-4 shrink-0 text-vialto-steel" aria-hidden />}
            </>
          );
          return (
            <li key={cargoId}>
              {ver ? (
                <button
                  type="button"
                  onClick={ver}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-vialto-mist"
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
      {aCuenta > 0.005 && (
        <p className="mt-3 text-sm text-vialto-steel tabular-nums">
          Quedan {monto(aCuenta, pago.moneda)} a cuenta (sin imputar).
        </p>
      )}
    </ViewModalShell>
  );
}
