import { useEffect } from 'react';
import { Ban, Banknote, Receipt } from 'lucide-react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
import { AmbienteTestBadge } from '@/components/liquidaciones/AmbienteTestBadge';
import { importeTotalConIvaPorTramo, roundMoney2 } from '@/lib/facturaTotales';
import {
  AfipInfraErrorBanner,
  ArcaErrorMessage,
} from '@/components/ui/ArcaErrorMessage';
import {
  formatStoredArcaError,
  isAfipInfrastructureError,
} from '@/lib/arcaFriendlyError';
import {
  facturaLetraFromCbteTipo,
  facturaLetraFromCondicionIva,
  facturaLetraLabel,
  facturaNcCbteTipoFromFactura,
  facturaNcLabel,
} from '@/lib/arcaCbteTipo';
import type { Cliente, Factura } from '@/types/api';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtImporte(moneda: string, importe: number, minDecimals?: number) {
  const prefix = moneda === 'USD' ? 'USD ' : '$ ';
  const opts = minDecimals != null ? { minimumFractionDigits: minDecimals } : undefined;
  return `${prefix}${importe.toLocaleString('es-AR', opts)}`;
}

const TIPO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'BORRADOR',
  esperando_afip: 'ESPERANDO AFIP',
  facturado: 'FACTURADO',
  error_afip: 'ERROR DE AFIP',
  anulado: 'ANULADO',
};

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'bg-zinc-100 text-zinc-800 border-zinc-300/90',
  esperando_afip: 'bg-amber-50 text-amber-950 border-amber-200/95',
  facturado: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  error_afip: 'bg-red-100 text-red-950 border-red-400/80',
  anulado: 'bg-gray-100 text-gray-500 border-gray-300/80 line-through',
};

/** Badge adicional de cobro — se muestra junto al de ciclo de vida, nunca lo reemplaza. */
const COBRADO_BADGE_CLASS = 'bg-emerald-200 text-emerald-950 border-emerald-600/90';
const VENCIDA_BADGE_CLASS = 'bg-orange-100 text-orange-950 border-orange-400/80';

export function FacturaViewModal({
  factura,
  clienteNombre,
  cliente,
  hasArca = false,
  onClose,
  onEditar,
  onVerComprobante,
  onEmitirArca,
  onAnular,
  onVerNotaCredito,
  onMarcarCobrada,
}: {
  factura: Factura;
  clienteNombre?: string;
  cliente?: Cliente | null;
  hasArca?: boolean;
  onClose: () => void;
  onEditar: () => void;
  onVerComprobante?: () => void;
  onEmitirArca?: () => void;
  onAnular?: () => void;
  onVerNotaCredito?: () => void;
  /** Solo facturas a cliente, no anuladas y no ya cobradas. */
  onMarcarCobrada?: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const importeFormato = fmtImporte(factura.moneda, factura.importe);
  const ivaN = factura.ivaPct ?? 0;
  const tramos = factura.tramos ?? [];
  const porTramo = Boolean(factura.facturarPorTramo) && tramos.length > 0;

  let muestraIva = false;
  let totalConIva = factura.importe;
  if (porTramo) {
    totalConIva =
      factura.ivaMonto != null && Number.isFinite(factura.ivaMonto)
        ? roundMoney2(factura.importe + factura.ivaMonto)
        : importeTotalConIvaPorTramo(factura.importe, tramos, ivaN);
    muestraIva = true;
  } else {
    muestraIva = ivaN > 0 && factura.importe > 0;
    const ivaMonto = roundMoney2((factura.importe * ivaN) / 100);
    totalConIva = roundMoney2(factura.importe + ivaMonto);
  }
  const cobroEsTotalConIva =
    factura.importeACobrar == null ||
    Math.abs(factura.importeACobrar - totalConIva) < 0.011;
  const saldoPendiente =
    porTramo &&
    !factura.cobrado &&
    cobroEsTotalConIva &&
    (factura.saldoPendiente ?? 0) > 0.005
      ? factura.saldoPendiente
      : null;

  const letraFromCbte = facturaLetraFromCbteTipo(factura.cbteTipo);
  const letra =
    hasArca && (letraFromCbte || cliente?.condicionIva != null)
      ? facturaLetraLabel(
          letraFromCbte ?? facturaLetraFromCondicionIva(cliente?.condicionIva),
        )
      : null;
  const anulada =
    factura.arcaEstado === 'anulado' || Boolean(factura.anulacionCae);
  const tieneCaeOriginal = Boolean(factura.cae);
  const autorizada =
    factura.arcaEstado === 'autorizado' || (tieneCaeOriginal && !anulada);
  const puedeEmitirArca =
    hasArca &&
    factura.tipo === 'cliente' &&
    factura.moneda !== 'USD' &&
    !autorizada &&
    !anulada &&
    !tieneCaeOriginal;
  const puedeAnular =
    hasArca &&
    factura.tipo === 'cliente' &&
    !anulada &&
    tieneCaeOriginal &&
    (factura.arcaEstado === 'autorizado' ||
      factura.arcaEstado === 'pendiente_cae' ||
      factura.arcaEstado === 'error');
  const puedeMarcarCobrada =
    factura.tipo === 'cliente' && !anulada && !factura.cobrado;

  const campos: { label: string; value: string | null | undefined }[] = [
    { label: 'Número', value: factura.numero },
    { label: 'Tipo', value: TIPO_LABEL[factura.tipo] ?? factura.tipo },
    ...(letra ? [{ label: 'Comprobante ARCA', value: letra }] : []),
    { label: 'Cliente', value: clienteNombre },
    { label: 'Importe', value: importeFormato },
    ...(porTramo
      ? [
          { label: 'Facturación', value: 'Por tramo' },
          ...(ivaN > 0
            ? [{ label: 'IVA viajes sin tramo', value: `${ivaN}%` }]
            : []),
          { label: 'Total con IVA', value: fmtImporte(factura.moneda, totalConIva, 2) },
          ...(saldoPendiente != null
            ? [
                {
                  label: 'Saldo pendiente',
                  value: fmtImporte(factura.moneda, saldoPendiente, 2),
                },
              ]
            : []),
        ]
      : muestraIva
        ? [
            { label: 'IVA', value: `${ivaN}%` },
            { label: 'Total con IVA', value: fmtImporte(factura.moneda, totalConIva, 2) },
          ]
        : []),
    { label: 'Fecha de emisión', value: factura.fechaEmision ? fmtDate(factura.fechaEmision) : null },
    { label: 'Fecha de vencimiento', value: factura.fechaVencimiento ? fmtDate(factura.fechaVencimiento) : null },
    {
      label: 'Diferencia',
      value: factura.diferencia != null ? `$ ${factura.diferencia.toLocaleString('es-AR')}` : null,
    },
    ...(factura.cae ? [{ label: 'CAE', value: factura.cae }] : []),
    ...(factura.caeFechaVto
      ? [{ label: 'Vto. CAE', value: fmtDate(factura.caeFechaVto) }]
      : []),
  ];

  const arcaErrorTexto = formatStoredArcaError(factura.arcaError);
  const mostrarArcaError =
    Boolean(arcaErrorTexto) &&
    (factura.arcaEstado === 'error' ||
      factura.arcaEstado === 'pendiente_cae' ||
      factura.estado === 'esperando_afip' ||
      factura.estado === 'error_afip');

  const ncTipo = facturaNcCbteTipoFromFactura(
    factura.anulacionCbteTipo ?? factura.cbteTipo,
    cliente?.condicionIva,
  );

  return (
    <ViewModalShell
      title={
        <span className="inline-flex items-center gap-3 flex-wrap">
          <span>Factura {factura.numero}</span>
          <span
            className={[
              'text-xs font-medium border rounded px-2 py-0.5',
              ESTADO_BADGE[factura.estado] ?? 'border-black/15 text-vialto-steel',
            ].join(' ')}
          >
            {ESTADO_LABEL[factura.estado] ?? factura.estado}
          </span>
          {factura.cobrado ? (
            <span
              className={[
                'text-xs font-medium border rounded px-2 py-0.5',
                COBRADO_BADGE_CLASS,
              ].join(' ')}
            >
              COBRADO
            </span>
          ) : puedeMarcarCobrada && onMarcarCobrada ? (
            <button
              type="button"
              onClick={onMarcarCobrada}
              title="Marcar como cobrada"
              className={[
                'text-xs font-medium border rounded px-2 py-0.5 cursor-pointer hover:brightness-95',
                factura.vencida ? VENCIDA_BADGE_CLASS : 'border-black/15 text-vialto-steel',
              ].join(' ')}
            >
              {factura.vencida ? 'VENCIDA' : 'MARCAR COBRADA'}
            </button>
          ) : null}
          <AmbienteTestBadge ambiente={factura.ambiente} />
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {puedeEmitirArca && onEmitirArca && (
            <button
              type="button"
              onClick={onEmitirArca}
              className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              <Receipt className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Emitir a ARCA
            </button>
          )}
          {puedeAnular && onAnular && (
            <button
              type="button"
              onClick={onAnular}
              className="inline-flex min-h-11 items-center gap-2 px-4 border border-red-300 text-xs uppercase tracking-wider text-red-800 hover:bg-red-50"
            >
              <Ban className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Anular
            </button>
          )}
          {puedeMarcarCobrada && onMarcarCobrada && (
            <button
              type="button"
              onClick={onMarcarCobrada}
              className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              <Banknote className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Marcar como cobrada
            </button>
          )}
          {!anulada && (
            <button type="button" onClick={onEditar} className={viewModalBtnPrimary}>
              Editar
            </button>
          )}
        </>
      }
    >
      <div className={viewModalGridClass}>
        {campos.filter((c) => c.value != null && c.value !== '').map((c, i) => (
          <div key={i}>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
            <p className="mt-1 text-sm">{c.value}</p>
          </div>
        ))}
      </div>

      {mostrarArcaError && arcaErrorTexto && (
        <div className="mt-4">
          {isAfipInfrastructureError(factura.arcaError) ||
          isAfipInfrastructureError(arcaErrorTexto) ? (
            <AfipInfraErrorBanner message={arcaErrorTexto} />
          ) : (
            <ArcaErrorMessage message={arcaErrorTexto} />
          )}
        </div>
      )}

      {porTramo && (
        <div className="mt-6 border-t border-black/10 pt-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
            Tramos
          </p>
          <ul className="space-y-2">
            {tramos
              .slice()
              .sort((a, b) => a.orden - b.orden)
              .map((t) => {
                const ivaMonto = (t.monto * t.ivaPct) / 100;
                const totalTramo = t.monto + ivaMonto;
                return (
                  <li
                    key={t.id}
                    className="border border-black/10 bg-vialto-mist/30 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-vialto-charcoal">{t.detalle}</p>
                    <p className="mt-1 text-xs text-vialto-steel">
                      Monto {fmtImporte(factura.moneda, t.monto, 2)}
                      {' · '}
                      IVA {t.ivaPct}% ({fmtImporte(factura.moneda, ivaMonto, 2)})
                      {' · '}
                      Total {fmtImporte(factura.moneda, totalTramo, 2)}
                    </p>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {anulada && (
        <div className="mt-6 border-t border-black/10 pt-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
            Anulación
          </p>
          <div className={viewModalGridClass}>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Tipo NC
              </p>
              <p className="mt-1 text-sm">{facturaNcLabel(ncTipo)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Anulada el
              </p>
              <p className="mt-1 text-sm">{fmtDateTime(factura.anuladoAt ?? factura.anulacionFecha)}</p>
            </div>
            {factura.anulacionCae && (
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  CAE NC
                </p>
                <p className="mt-1 text-sm">{factura.anulacionCae}</p>
              </div>
            )}
            {factura.anulacionCaeFechaVto && (
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  Vto. CAE NC
                </p>
                <p className="mt-1 text-sm">{fmtDate(factura.anulacionCaeFechaVto)}</p>
              </div>
            )}
            {factura.motivoAnulacion && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  Motivo
                </p>
                <p className="mt-1 text-sm">{factura.motivoAnulacion}</p>
              </div>
            )}
            {(factura.anuladoPorNombre || factura.anuladoPor) && (
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  Anulada por
                </p>
                <p className="mt-1 text-sm">
                  {factura.anuladoPorNombre ?? factura.anuladoPor}
                </p>
              </div>
            )}
          </div>
          {onVerNotaCredito && (factura.notaCreditoUrl?.trim() || factura.anulacionCae) && (
            <button
              type="button"
              onClick={onVerNotaCredito}
              className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist"
            >
              Ver Nota de Crédito
            </button>
          )}
        </div>
      )}

      {onVerComprobante && factura.comprobanteUrl?.trim() && (
        <div className="mt-6 border-t border-black/10 pt-4">
          <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Comprobante</p>
          <button
            type="button"
            onClick={onVerComprobante}
            className="mt-2 text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist"
          >
            Ver comprobante
          </button>
        </div>
      )}
    </ViewModalShell>
  );
}
