import { ChevronRight } from 'lucide-react';
import { ViewModalShell, viewModalBtnGhost } from '@/components/ui/ViewModalShell';
import { formatCurrencyArFromNumber } from '@/lib/currencyMask';
import { fmtDateUtc } from '@/lib/fmtDateUtc';
import { claseMontoCobroPago, type MovimientoCc } from '@/lib/cuentaCorriente';

type Props = {
  /** La venta/compra imputada. */
  cargo: MovimientoCc;
  /** Movimientos de la cuenta (de acá salen los cobros/pagos imputados a la venta/compra). */
  movimientos: MovimientoCc[];
  /** Abre el detalle del cobro/pago tocado. */
  onVerMovimiento: (m: MovimientoCc) => void;
  onClose: () => void;
};

const monto = (n: number, moneda: string) => `$ ${formatCurrencyArFromNumber(n)} ${moneda}`;

/** Cobros/pagos imputados a una venta/compra, con cuánto aplicó cada uno. */
export function imputacionesDeCargo(cargo: MovimientoCc, movimientos: MovimientoCc[]) {
  return movimientos
    .filter((m) => m.tipo === 'pago')
    .flatMap((pago) =>
      (pago.imputacionesPorCargo ?? [])
        .filter((i) => i.cargoId === cargo.id)
        .map((i) => ({ pago, importe: i.importe })),
    )
    .sort((a, b) => new Date(a.pago.fecha).getTime() - new Date(b.pago.fecha).getTime());
}

/**
 * Detalle de una venta/compra imputada: qué cobros/pagos la cancelan, cuánto aplicó cada
 * uno y cuánto le queda. Espejo de `ImputacionesCobroModal` (que va del cobro a las ventas).
 */
export function ImputacionesCargoModal({ cargo, movimientos, onVerMovimiento, onClose }: Props) {
  const esVenta = !!cargo.clienteId;
  const filas = imputacionesDeCargo(cargo, movimientos);
  const totalImputado = filas.reduce((s, f) => s + f.importe, 0);
  const saldo = cargo.pendiente ?? Math.max(0, cargo.importe - totalImputado);
  const numero = cargo.numeroComprobante?.trim();

  return (
    <ViewModalShell
      title={`Imputación — ${cargo.concepto}${numero ? ` ${numero}` : ''}`}
      onClose={onClose}
      maxWidthClass="sm:max-w-2xl"
      footer={
        <button type="button" className={viewModalBtnGhost} onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {/* Mismo resumen que "Imputar cobro": total, lo imputado y lo que falta. */}
      <dl className="mb-4 grid grid-cols-3 divide-x divide-black/10 border border-black/10 bg-vialto-mist/40 text-sm">
        <div className="px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-vialto-steel">Total</dt>
          <dd className="tabular-nums text-vialto-charcoal">{monto(cargo.importe, cargo.moneda)}</dd>
        </div>
        <div className="px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-vialto-steel">
            {esVenta ? 'Cobrado' : 'Pagado'}
          </dt>
          <dd className={`tabular-nums ${claseMontoCobroPago(esVenta)}`}>{monto(totalImputado, cargo.moneda)}</dd>
        </div>
        <div className="px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-vialto-steel">
            {esVenta ? 'Falta cobrar' : 'Falta pagar'}
          </dt>
          <dd
            className={`font-semibold tabular-nums ${saldo > 0.005 ? 'text-vialto-fire' : 'text-vialto-charcoal'}`}
          >
            {monto(saldo, cargo.moneda)}
          </dd>
        </div>
      </dl>

      <ul className="divide-y divide-black/10 border border-black/10">
        {filas.map(({ pago, importe }) => (
          <li key={pago.id}>
           {/* Tocar el cobro/pago abre su detalle. */}
           <button
            type="button"
            onClick={() => onVerMovimiento(pago)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-vialto-mist"
           >
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate ${
                  pago.numeroComprobante?.trim() ? 'font-medium text-vialto-charcoal' : 'italic text-vialto-steel'
                }`}
              >
                {pago.numeroComprobante?.trim() || 'Sin comprobante'}
              </span>
              <span className="text-xs text-vialto-steel">
                {pago.concepto} · {fmtDateUtc(pago.fecha)} · total{' '}
                <span className={claseMontoCobroPago(esVenta)}>{monto(pago.importe, pago.moneda)}</span>
              </span>
            </span>
            <span className="shrink-0 text-right tabular-nums text-vialto-charcoal">
              Imputado{' '}
              <span className={claseMontoCobroPago(esVenta)}>{monto(importe, cargo.moneda)}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-vialto-steel" aria-hidden />
           </button>
          </li>
        ))}
      </ul>
    </ViewModalShell>
  );
}
