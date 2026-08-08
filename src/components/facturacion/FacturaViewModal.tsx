import { useEffect } from 'react';
import { Ban, Banknote, Receipt } from 'lucide-react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
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
  transportista_externo: 'Transportista externo',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  cobrada: 'Cobrada',
  vencida: 'Vencida',
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-950 border-amber-300/90',
  cobrada: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  vencida: 'bg-red-100 text-red-950 border-red-400/80',
};

const ARCA_ESTADO_LABEL: Record<string, string> = {
  pendiente_cae: 'Pendiente CAE',
  autorizado: 'Autorizado ARCA',
  error: 'Error ARCA',
  anulado: 'Anulado',
};

const ARCA_ESTADO_BADGE: Record<string, string> = {
  pendiente_cae: 'bg-sky-100 text-sky-950 border-sky-300/90',
  autorizado: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  error: 'bg-red-100 text-red-950 border-red-400/80',
  anulado: 'bg-gray-100 text-gray-600 border-gray-300/80',
};

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
  /** Solo facturas a cliente. Se muestra siempre (aunque ya esté cobrada) — ver `onClick` del caller. */
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
  const muestraIva = ivaN > 0 && factura.importe > 0;
  const totalConIva = factura.importe * (1 + ivaN / 100);
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

  const campos: { label: string; value: string | null | undefined }[] = [
    { label: 'Número', value: factura.numero },
    { label: 'Tipo', value: TIPO_LABEL[factura.tipo] ?? factura.tipo },
    ...(letra ? [{ label: 'Comprobante ARCA', value: letra }] : []),
    { label: 'Cliente', value: clienteNombre },
    { label: 'Importe', value: importeFormato },
    ...(muestraIva
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
    ...(factura.arcaError && factura.arcaEstado === 'error'
      ? [{ label: 'Error ARCA', value: factura.arcaError }]
      : []),
  ];

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
          {hasArca && factura.arcaEstado && (
            <span
              className={[
                'text-xs font-medium border rounded px-2 py-0.5',
                ARCA_ESTADO_BADGE[factura.arcaEstado] ?? 'border-black/15 text-vialto-steel',
              ].join(' ')}
            >
              {ARCA_ESTADO_LABEL[factura.arcaEstado] ?? factura.arcaEstado}
            </span>
          )}
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
              className="inline-flex items-center gap-2 h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              <Receipt className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Emitir a ARCA
            </button>
          )}
          {puedeAnular && onAnular && (
            <button
              type="button"
              onClick={onAnular}
              className="inline-flex items-center gap-2 h-9 px-4 border border-red-300 text-xs uppercase tracking-wider text-red-800 hover:bg-red-50"
            >
              <Ban className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Anular
            </button>
          )}
          {factura.tipo === 'cliente' && !anulada && onMarcarCobrada && (
            <button
              type="button"
              onClick={onMarcarCobrada}
              className="inline-flex items-center gap-2 h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
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
