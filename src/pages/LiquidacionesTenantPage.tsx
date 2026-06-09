import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Landmark, Receipt } from 'lucide-react';
import { ListadoCard } from '@/components/listado/ListadoCard';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { EmitirLiquidacionModal } from '@/components/liquidaciones/EmitirLiquidacionModal';
import { CrearLiquidacionManualModal } from '@/components/liquidaciones/CrearLiquidacionManualModal';
import { apiFetch, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
} from '@/lib/listadoTabla';
import { useMaestroData } from '@/hooks/useMaestroData';
import { canAccessIntegracionArca } from '@/lib/tenantModules';
import type { ArcaConfig, Liquidacion, LiquidacionEstado } from '@/types/api';

type LiquidacionConTransportista = Liquidacion & {
  transportista?: { id: string; nombre: string; idFiscal: string | null } | null;
};

const ESTADO_LABEL: Record<LiquidacionEstado, string> = {
  borrador: 'Borrador',
  pendiente_cae: 'Pendiente CAE',
  autorizado: 'Autorizado',
  error: 'Error',
  anulado: 'Anulado',
};

const ESTADO_CLASS: Record<LiquidacionEstado, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente_cae: 'bg-amber-100 text-amber-800',
  autorizado: 'bg-emerald-100 text-emerald-800',
  error: 'bg-red-100 text-red-800',
  anulado: 'bg-gray-100 text-gray-500 line-through',
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function transportistaNombre(liq: LiquidacionConTransportista) {
  return liq.transportista?.nombre ?? liq.transportistaId;
}

function caeCell(liq: LiquidacionConTransportista) {
  if (liq.cae) {
    return (
      <div>
        <p className="font-mono">{liq.cae}</p>
        {liq.caeFechaVto && (
          <p className="text-[11px]">Vto: {fmtDate(liq.caeFechaVto)}</p>
        )}
      </div>
    );
  }
  if (liq.arcaError) {
    return (
      <p className="text-red-600 text-[11px] max-w-[180px] truncate" title={liq.arcaError}>
        {liq.arcaError}
      </p>
    );
  }
  return '—';
}

function LiquidacionAcciones({
  liq,
  hasArca,
  isBusy,
  isDownloading,
  actionErrorMsg,
  onEmitir,
  onPdf,
  onAnular,
  onEliminar,
}: {
  liq: LiquidacionConTransportista;
  hasArca: boolean;
  isBusy: boolean;
  isDownloading: boolean;
  actionErrorMsg?: string;
  onEmitir: () => void;
  onPdf: () => void;
  onAnular: () => void;
  onEliminar: () => void;
}) {
  const puedeEmitir = hasArca && (liq.estado === 'borrador' || liq.estado === 'error');
  const puedeEliminar = liq.estado === 'borrador' || liq.estado === 'error' || liq.estado === 'pendiente_cae';
  const puedeAnular = hasArca && liq.estado === 'autorizado';
  const tienePdf = hasArca && (liq.estado === 'autorizado' || liq.estado === 'anulado');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {puedeEmitir && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onEmitir}
            className={`${listadoTablaAccionClass} inline-flex items-center gap-1.5 h-7 px-3`}
          >
            <Receipt className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {isBusy ? '…' : 'Emitir'}
          </button>
        )}
        {tienePdf && (
          <button
            type="button"
            disabled={isDownloading}
            onClick={onPdf}
            className={`${listadoTablaAccionClass} h-7 px-3`}
          >
            {isDownloading ? '…' : 'PDF'}
          </button>
        )}
        {puedeAnular && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onAnular}
            className={`${listadoTablaAccionClass} h-7 px-3 text-red-700 hover:bg-red-50`}
          >
            {isBusy ? '…' : 'Anular'}
          </button>
        )}
        {puedeEliminar && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onEliminar}
            className={`${listadoTablaAccionClass} h-7 px-3 text-red-700 hover:bg-red-50`}
          >
            {isBusy ? '…' : 'Eliminar'}
          </button>
        )}
      </div>
      {actionErrorMsg && (
        <p className="mt-1 text-right text-xs text-red-700">{actionErrorMsg}</p>
      )}
    </div>
  );
}

export function LiquidacionesTenantPage() {
  const { getToken } = useAuth();
  const { tenant, transportistas } = useMaestroData();
  const hasArca = canAccessIntegracionArca(tenant?.modules ?? []);
  const [rows, setRows] = useState<LiquidacionConTransportista[] | null>(null);
  const [config, setConfig] = useState<ArcaConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; msg: string } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [pendingEmitir, setPendingEmitir] = useState<LiquidacionConTransportista | null>(null);
  const [showCrear, setShowCrear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [data, cfg] = await Promise.all([
          apiJson<LiquidacionConTransportista[]>('/api/integracion-arca/liquidaciones', () => getToken()),
          apiJson<ArcaConfig | null>('/api/integracion-arca/config', () => getToken()).catch(() => null),
        ]);
        if (!cancelled) {
          setRows(data);
          setConfig(cfg);
        }
      } catch (err) {
        if (!cancelled) setError(friendlyError(err, 'arca'));
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  function onEmitirSuccess(updated: LiquidacionConTransportista) {
    setRows((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
    setPendingEmitir(null);
  }

  async function eliminar(liq: LiquidacionConTransportista) {
    if (!confirm(`¿Eliminar la liquidación de ${transportistaNombre(liq)}? Esta acción no se puede deshacer.`)) return;
    setActionError(null);
    setBusyId(liq.id);
    try {
      await apiFetch(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
        () => getToken(),
        { method: 'DELETE' },
      );
      setRows((prev) => prev?.filter((r) => r.id !== liq.id) ?? prev);
    } catch (err) {
      setActionError({ id: liq.id, msg: friendlyError(err, 'arca') });
    } finally {
      setBusyId(null);
    }
  }

  async function anular(liq: LiquidacionConTransportista) {
    if (!confirm(`¿Anular la liquidación de ${transportistaNombre(liq)}? Esta acción emite un comprobante negativo en ARCA.`)) return;
    setActionError(null);
    setBusyId(liq.id);
    try {
      const updated = await apiJson<LiquidacionConTransportista>(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/anular`,
        () => getToken(),
        { method: 'POST' },
      );
      setRows((prev) => prev?.map((r) => (r.id === updated.id ? { ...updated, transportista: r.transportista } : r)) ?? prev);
    } catch (err) {
      setActionError({ id: liq.id, msg: friendlyError(err, 'arca') });
    } finally {
      setBusyId(null);
    }
  }

  async function descargarPdf(liq: LiquidacionConTransportista) {
    setDownloading(liq.id);
    try {
      const res = await apiFetch(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}/pdf`,
        () => getToken(),
      );
      if (!res.ok) throw new Error('Error al generar el PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liquidacion-${liq.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError({ id: liq.id, msg: friendlyError(err, 'arca') });
    } finally {
      setDownloading(null);
    }
  }

  function accionesProps(liq: LiquidacionConTransportista) {
    return {
      liq,
      hasArca,
      isBusy: busyId === liq.id,
      isDownloading: downloading === liq.id,
      actionErrorMsg: actionError?.id === liq.id ? actionError.msg : undefined,
      onEmitir: () => setPendingEmitir(liq),
      onPdf: () => void descargarPdf(liq),
      onAnular: () => void anular(liq),
      onEliminar: () => void eliminar(liq),
    };
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Liquidaciones
      </h1>
      <p className="mt-1 text-sm text-vialto-steel">
        {hasArca ? 'Comprobantes CVLP tipo 60 emitidos a transportistas.' : 'Liquidaciones emitidas a transportistas.'}
      </p>
      {hasArca && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
          <Landmark className="h-3 w-3 shrink-0" strokeWidth={1.75} />
          Emisión electrónica vía ARCA
        </div>
      )}

      <div className="mt-4">
        {error && (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-2">
          {!hasArca && (
            <button
              type="button"
              onClick={() => setShowCrear(true)}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              Nueva liquidación
            </button>
          )}
        </div>
      </div>

      <ListadoDatos
        className="mt-6"
        columns={[
          {
            id: 'transportista',
            header: 'Transportista',
            primary: true,
            cell: (liq) => (
              <>
                <p className="font-medium">{transportistaNombre(liq)}</p>
                {liq.transportista?.idFiscal && (
                  <p className="text-xs text-vialto-steel">{liq.transportista.idFiscal}</p>
                )}
              </>
            ),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'periodo',
            header: 'Período',
            cell: (liq) => `${fmtDate(liq.periodoDesde)} — ${fmtDate(liq.periodoHasta)}`,
            tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
          },
          {
            id: 'viajes',
            header: 'Viajes',
            cell: (liq) => liq.cantViajes,
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: 'bruto',
            header: 'Bruto',
            cell: (liq) => fmtMoney(liq.bruto),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
          {
            id: 'comision',
            header: 'Comisión',
            cell: (liq) => (
              <>
                {fmtMoney(liq.comision)}
                <span className="ml-1 text-xs">({liq.comisionPct}%)</span>
              </>
            ),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums text-vialto-steel`,
          },
          {
            id: 'liquido',
            header: 'Líquido',
            cell: (liq) => fmtMoney(liq.liquido),
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums font-medium`,
          },
          {
            id: 'estado',
            header: 'Estado',
            cell: (liq) => (
              <span className={`inline-block px-2 py-0.5 text-xs rounded ${ESTADO_CLASS[liq.estado]}`}>
                {ESTADO_LABEL[liq.estado]}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'cae',
            header: 'CAE',
            cell: (liq) => caeCell(liq),
            tdClassName: `${listadoTablaTdClass} text-xs text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(liq) => liq.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar las liquidaciones.'
            : 'Todavía no hay liquidaciones. Creá una desde las acciones de un viaje.'
        }
        loadingMessage="Cargando…"
        renderActions={(liq) => <LiquidacionAcciones {...accionesProps(liq)} />}
        actionsTdClassName={`${listadoTablaTdClass} text-right`}
        renderMobileCard={(liq) => (
          <ListadoCard
            primary={transportistaNombre(liq)}
            fields={[
              {
                label: 'Período',
                value: `${fmtDate(liq.periodoDesde)} — ${fmtDate(liq.periodoHasta)}`,
              },
              { label: 'Viajes', value: liq.cantViajes },
              { label: 'Bruto', value: fmtMoney(liq.bruto) },
              {
                label: 'Comisión',
                value: (
                  <>
                    {fmtMoney(liq.comision)}
                    <span className="ml-1 text-xs">({liq.comisionPct}%)</span>
                  </>
                ),
              },
              { label: 'Líquido', value: fmtMoney(liq.liquido) },
              {
                label: 'Estado',
                value: (
                  <span className={`inline-block px-2 py-0.5 text-xs rounded ${ESTADO_CLASS[liq.estado]}`}>
                    {ESTADO_LABEL[liq.estado]}
                  </span>
                ),
              },
              { label: 'CAE', value: caeCell(liq) },
            ]}
            actions={<LiquidacionAcciones {...accionesProps(liq)} />}
          />
        )}
      />

      {pendingEmitir && hasArca && (
        <EmitirLiquidacionModal
          liq={pendingEmitir}
          getToken={getToken}
          onSuccess={onEmitirSuccess}
          onClose={() => setPendingEmitir(null)}
          ivaPct={config?.ivaGastosAdmin}
        />
      )}

      {showCrear && (
        <CrearLiquidacionManualModal
          transportistas={transportistas}
          getToken={getToken}
          onSuccess={(liq) => {
            setRows((prev) => (prev ? [{ ...liq, transportista: transportistas.find((t) => t.id === liq.transportistaId) ?? null }, ...prev] : [{ ...liq, transportista: null }]));
            setShowCrear(false);
          }}
          onClose={() => setShowCrear(false)}
        />
      )}
    </div>
  );
}
