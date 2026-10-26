import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, Banknote, FileText, Paperclip, Receipt, RotateCw } from 'lucide-react';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import {
  idPropio2Habilitado as idPropio2HabilitadoTenant,
  idPropio2Label as idPropio2LabelTenant,
} from '@/lib/viajesFlota';
import {
  Dato,
  DatosCabecera,
  DetalleMontosCard,
  FilaMonto,
  FilaMontoDesplegable,
  ViajesDetalleLista,
} from '@/components/shared/DetalleComprobante';
import { useAuth } from '@clerk/clerk-react';
import { apiJson } from '@/lib/api';
import { verPdfFacturaArca } from '@/lib/facturaPdfArca';
import { usuarioLabel } from '@/lib/usuarioLabel';
import { friendlyError } from '@/lib/friendlyError';
import { useToast } from '@/lib/toast';
import { ViajeViewModal } from '@/components/viajes/ViajeViewModal';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
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
  facturaEditable,
  facturaNcLabel,
  nroComprobante,
} from '@/lib/arcaCbteTipo';
import type { Cliente, Factura, Viaje } from '@/types/api';
import { fmtDateUtc } from '@/lib/fmtDateUtc';

function fmtDate(iso: string | null | undefined) {
  return fmtDateUtc(iso);
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
  getToken,
  onClose,
  onEditar,
  onVerComprobante,
  onAdjuntarComprobante,
  onEmitirArca,
  onAnular,
  onMarcarCobrada,
  onVolverAEmitir,
  idPropio2Habilitado: idPropio2HabilitadoProp,
  idPropio2Label: idPropio2LabelProp,
}: {
  factura: Factura;
  clienteNombre?: string;
  cliente?: Cliente | null;
  hasArca?: boolean;
  getToken?: () => Promise<string | null>;
  onClose: () => void;
  onEditar: () => void;
  onVerComprobante?: () => void;
  /** Solo sin ARCA: botón "Adjuntar comprobante" si la factura todavía no tiene archivo. */
  onAdjuntarComprobante?: () => void;
  onEmitirArca?: () => void;
  onAnular?: () => void;
  /** Solo facturas a cliente, no anuladas y no ya cobradas. */
  onMarcarCobrada?: () => void;
  /**
   * Factura anulada: abre "Nueva factura" precargada con sus datos. Sin handler, el botón
   * navega a Facturas con `volverAEmitirFacturaId` y la pantalla lo resuelve.
   */
  onVolverAEmitir?: () => void;
  /**
   * true = el tenant habilitó "ID Propio 2" — se muestra junto a cada viaje (igual que en
   * Liquidación). Sin prop se toma la configuración de la empresa propia.
   */
  idPropio2Habilitado?: boolean;
  /** Label configurable de "ID Propio 2". Sin prop, el de la empresa propia. */
  idPropio2Label?: string;
}) {
  const { tenant: tenantPropio } = useCurrentTenant();
  const mostrarIdPropio2 = idPropio2HabilitadoProp ?? idPropio2HabilitadoTenant(tenantPropio);
  const labelIdPropio2 = idPropio2LabelProp ?? idPropio2LabelTenant(tenantPropio);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { getToken: getAuthToken } = useAuth();
  const [searchParams] = useSearchParams();
  const tenantIdUrl = searchParams.get('tenantId')?.trim() ?? '';
  const [detail, setDetail] = useState<Factura>(factura);
  const [loadingDetail, setLoadingDetail] = useState(Boolean(getToken));
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
  const [loadingViajeId, setLoadingViajeId] = useState<string | null>(null);

  async function handleVerViaje(viajeId: string) {
    if (!getToken) return;
    setLoadingViajeId(viajeId);
    try {
      const viaje = await apiJson<Viaje>(
        `/api/viajes/${encodeURIComponent(viajeId)}`,
        () => getToken(),
      );
      setViewingViaje(viaje);
    } catch (e) {
      showToast(friendlyError(e, 'viajes'), 'error');
    } finally {
      setLoadingViajeId(null);
    }
  }
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!getToken || !factura.id) {
      setDetail((prev) => ({
        ...prev,
        ...factura,
        viajes: factura.viajes ?? prev.viajes,
      }));
      setLoadingDetail(false);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const full = await apiJson<Factura>(
          `/api/facturacion/facturas/${encodeURIComponent(factura.id)}`,
          () => getToken(),
        );
        if (!cancelled) setDetail({ ...full, viajes: full.viajes ?? factura.viajes });
      } catch {
        if (!cancelled) setDetail(factura);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, factura.id]);

  useEffect(() => {
    setDetail((prev) => ({
      ...prev,
      ...factura,
      viajes: factura.viajes?.length ? factura.viajes : prev.viajes,
    }));
  }, [factura]);

  const source = detail;
  const ivaN = source.ivaPct ?? 0;
  const tramos = source.tramos ?? [];
  const porTramo = Boolean(factura.facturarPorTramo) && tramos.length > 0;
  const viajeIdsConTramo = new Set(tramos.map((t) => t.viajeId).filter(Boolean));
  const tieneViajesSinTramo = (source.viajes ?? []).some(
    (v) => v.id && !viajeIdsConTramo.has(v.id),
  );

  let muestraIva = false;
  let totalConIva = factura.importe;
  if (porTramo) {
    totalConIva =
      factura.ivaMonto != null && Number.isFinite(factura.ivaMonto)
        ? roundMoney2(factura.importe + factura.ivaMonto)
        : importeTotalConIvaPorTramo(factura.importe, tramos, ivaN, source.viajes);
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
  // Con ARCA solo se edita un borrador: una factura emitida se corrige anulándola y volviendo
  // a emitir (el backend también lo rechaza). Sin ARCA no hay estados de emisión.
  const puedeEditar = facturaEditable(factura);
  const puedeMarcarCobrada =
    factura.tipo === 'cliente' && !anulada && !factura.cobrado;

  const fmt2 = (n: number) => fmtImporte(factura.moneda, n, 2);
  const ivaTotal = roundMoney2(totalConIva - factura.importe);
  const viajesFactura = source.viajes ?? [];
  const cantViajes = viajesFactura.length || source.viajeIds.length;
  // Viajes que componen el neto: se ven al desplegar la fila "Neto" del detalle.
  const viajesDetalle = (
    <ViajesDetalleLista
      items={viajesFactura.map((v) => ({
        key: v.id,
        viajeId: v.id,
        numero: String(v.numeroIdentificacionPersonalizado?.trim() || v.numero || '—'),
        fechaCarga: v.fechaCarga,
        origen: v.origen,
        destino: v.destino,
        extra:
          mostrarIdPropio2 && v.idPropio2?.trim()
            ? `${labelIdPropio2}: ${v.idPropio2.trim()}`
            : null,
        importe: fmtImporte(v.monedaMonto, Number(v.monto) || 0, 2),
      }))}
      vacio={cantViajes > 0 ? 'Sin detalle disponible.' : 'Sin viajes asociados.'}
      loadingViajeId={loadingViajeId}
      onVerViaje={(id) => void handleVerViaje(id)}
      fmtFecha={fmtDate}
    />
  );
  // Por tramo: el IVA se arma por tramo; al desplegar la fila de IVA se ve cada uno.
  const tramosDetalle = (
    <div className="divide-y divide-black/5">
      {tramos
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((t) => (
          <div
            key={t.id}
            className="flex items-baseline justify-between gap-4 py-1.5 pl-5"
          >
            <span className="min-w-0">
              <span className="block text-xs text-vialto-charcoal">{t.detalle}</span>
              <span className="block text-[11px] text-vialto-steel">
                {fmt2(t.monto)} · IVA {t.ivaPct}%
              </span>
            </span>
            <span className="shrink-0 text-sm tabular-nums text-vialto-charcoal">
              + {fmt2(roundMoney2((t.monto * t.ivaPct) / 100))}
            </span>
          </div>
        ))}
    </div>
  );
  // Botones de comprobantes del pie: con anulación se distingue el original de la NC.
  // Factura emitida en ARCA: los dos PDF se generan en el momento (mismo diseño, el actual);
  // sin ARCA, "Ver comprobante" abre el archivo que se adjuntó.
  const emitidaEnArca = Boolean(factura.cae);
  const puedeVerComprobante =
    emitidaEnArca || Boolean(onVerComprobante && factura.comprobanteUrl?.trim());
  const puedeVerNotaCredito = Boolean(anulada && factura.anulacionCae);

  function verPdfArca(kind: 'factura' | 'nc') {
    verPdfFacturaArca(
      factura.id,
      kind,
      () => (getToken ? getToken() : getAuthToken()),
      tenantIdUrl || undefined,
    ).catch((e) => showToast(friendlyError(e, 'arca'), 'error'));
  }

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
    <>
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
          ) : puedeMarcarCobrada && factura.vencida ? (
            // Acción deshabilitada para la empresa: VENCIDA queda como badge fijo.
            <span
              className={[
                'text-xs font-medium border rounded px-2 py-0.5',
                VENCIDA_BADGE_CLASS,
              ].join(' ')}
            >
              VENCIDA
            </span>
          ) : null}
          <AmbienteTestBadge ambiente={factura.ambiente} />
        </span>
      }
      onClose={onClose}
      // Mismo ancho y scroll que el detalle de liquidación.
      scrollBody
      maxWidthClass="sm:max-w-4xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {puedeVerComprobante && (
            <button
              type="button"
              onClick={emitidaEnArca ? () => verPdfArca('factura') : onVerComprobante}
              className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {puedeVerNotaCredito ? 'Ver comprobante original' : 'Ver comprobante'}
            </button>
          )}
          {onAdjuntarComprobante && !emitidaEnArca && !factura.comprobanteUrl?.trim() && (
            <button
              type="button"
              onClick={onAdjuntarComprobante}
              className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              <Paperclip className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Adjuntar comprobante
            </button>
          )}
          {puedeVerNotaCredito && (
            <button
              type="button"
              onClick={() => verPdfArca('nc')}
              className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Ver nota de crédito
            </button>
          )}
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
          {/* Anulada implica ARCA (la NC sale de ahí): no depende de que la pantalla pase `hasArca`. */}
          {anulada && (
            <button
              type="button"
              onClick={
                onVolverAEmitir ??
                // Abierto desde otra pantalla (Viajes, Cuenta corriente, Inicio): se va a
                // Facturas, que abre "Nueva factura" precargada con esta.
                // Superadmin: la empresa viene en `?tenantId=` y Facturas la toma del state.
                (() =>
                  navigate('/facturacion', {
                    state: {
                      volverAEmitirFacturaId: factura.id,
                      ...(tenantIdUrl ? { tenantId: tenantIdUrl } : {}),
                    },
                  }))
              }
              className="inline-flex min-h-11 items-center gap-2 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              <RotateCw className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Volver a emitir
            </button>
          )}
          {puedeEditar && (
            <button type="button" onClick={onEditar} className={viewModalBtnPrimary}>
              Editar
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {/* Datos de cabecera (cliente, comprobante, fechas, CAE, anulación) en un bloque compacto. */}
        <DatosCabecera>
          <Dato
            label="Cliente"
            value={clienteNombre}
            sub={cliente?.idFiscal ? `CUIT ${cliente.idFiscal}` : undefined}
            className="col-span-2 sm:col-span-1"
          />
          <Dato
            label="Comprobante"
            value={letra ?? 'Factura'}
            sub={factura.numero ? `N° ${factura.numero}` : undefined}
          />
          <Dato
            label="Emisión"
            value={factura.fechaEmision ? fmtDate(factura.fechaEmision) : '—'}
            sub={
              factura.fechaVencimiento
                ? `Vence ${fmtDate(factura.fechaVencimiento)}`
                : undefined
            }
          />
          {factura.cae && (
            <Dato
              label="CAE"
              value={factura.cae}
              sub={factura.caeFechaVto ? `Vto. ${fmtDate(factura.caeFechaVto)}` : undefined}
            />
          )}
          <Dato
            label="Creada"
            value={fmtDate(factura.createdAt)}
            sub={
              factura.ambiente
                ? factura.ambiente === 'homologacion'
                  ? 'Homologación (prueba)'
                  : 'Producción'
                : undefined
            }
          />
          {factura.diferencia != null && (
            <Dato
              label="Diferencia"
              value={`$ ${factura.diferencia.toLocaleString('es-AR')}`}
            />
          )}
          {anulada && (
            <>
              <Dato
                label="Anulada"
                value={fmtDateTime(factura.anuladoAt ?? factura.anulacionFecha)}
                sub={
                  factura.anuladoPorNombre || factura.anuladoPor
                    ? `Por ${usuarioLabel(factura.anuladoPorNombre, factura.anuladoPor)}`
                    : undefined
                }
              />
              <Dato
                label={facturaNcLabel(ncTipo).replace(/ \(cód\. \d+\)$/, '')}
                value={
                  factura.anulacionCbteNro != null
                    ? `N° ${nroComprobante(factura.anulacionPtoVenta, factura.anulacionCbteNro)}`
                    : '—'
                }
                sub={factura.anulacionCae ? `CAE ${factura.anulacionCae}` : undefined}
              />
              {factura.motivoAnulacion && (
                <Dato
                  label="Motivo de anulación"
                  value={factura.motivoAnulacion}
                  className="col-span-2 sm:col-span-1"
                />
              )}
            </>
          )}
        </DatosCabecera>

        <DetalleMontosCard loading={loadingDetail}>
          <FilaMontoDesplegable
            label="Neto"
            resumen={
              cantViajes > 0 ? `${cantViajes} viaje${cantViajes === 1 ? '' : 's'}` : undefined
            }
            value={fmt2(factura.importe)}
          >
            {viajesDetalle}
          </FilaMontoDesplegable>
          {porTramo ? (
            <FilaMontoDesplegable
              label="IVA por tramo"
              resumen={`${tramos.length} tramo${tramos.length === 1 ? '' : 's'}${
                tieneViajesSinTramo && ivaN > 0 ? ` · viajes sin tramo ${ivaN}%` : ''
              }`}
              value={`+ ${fmt2(ivaTotal)}`}
            >
              {tramosDetalle}
            </FilaMontoDesplegable>
          ) : (
            muestraIva && (
              <FilaMonto label={`IVA ${ivaN}%`} value={`+ ${fmt2(ivaTotal)}`} muted />
            )
          )}
          <FilaMonto
            label={muestraIva ? 'Total con IVA' : 'Total'}
            value={fmt2(totalConIva)}
            bold
            separator
          />
          {saldoPendiente != null && (
            <FilaMonto label="Saldo pendiente" value={fmt2(saldoPendiente)} muted />
          )}
        </DetalleMontosCard>
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

      </ViewModalShell>
      {viewingViaje && (
        <ViajeViewModal
          viaje={viewingViaje}
          onClose={() => setViewingViaje(null)}
          onEditar={() => {
            const viajeId = viewingViaje.id;
            setViewingViaje(null);
            onClose();
            navigate(`/viajes?viaje=${encodeURIComponent(viajeId)}`);
          }}
        />
      )}
    </>
  );
}
