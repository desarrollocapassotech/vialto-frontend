import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Liquidacion, LiquidacionEstado } from '@/types/api';

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

export function LiquidacionesTenantPage() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<LiquidacionConTransportista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; msg: string } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiJson<LiquidacionConTransportista[]>(
          '/api/liquidaciones-arca/liquidaciones',
          () => getToken(),
        );
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(friendlyError(err, 'arca'));
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  async function emitirArca(liq: LiquidacionConTransportista) {
    setActionError(null);
    setBusyId(liq.id);
    try {
      const updated = await apiJson<LiquidacionConTransportista>(
        `/api/liquidaciones-arca/liquidaciones/${encodeURIComponent(liq.id)}/emitir`,
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

  async function eliminar(liq: LiquidacionConTransportista) {
    if (!confirm(`¿Eliminar la liquidación de ${liq.transportista?.nombre ?? liq.transportistaId}? Esta acción no se puede deshacer.`)) return;
    setActionError(null);
    setBusyId(liq.id);
    try {
      await apiFetch(
        `/api/liquidaciones-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
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
    if (!confirm(`¿Anular la liquidación de ${liq.transportista?.nombre ?? liq.transportistaId}? Esta acción emite un comprobante negativo en ARCA.`)) return;
    setActionError(null);
    setBusyId(liq.id);
    try {
      const updated = await apiJson<LiquidacionConTransportista>(
        `/api/liquidaciones-arca/liquidaciones/${encodeURIComponent(liq.id)}/anular`,
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
        `/api/liquidaciones-arca/liquidaciones/${encodeURIComponent(liq.id)}/pdf`,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          Liquidaciones CVLP
        </h1>
        <p className="mt-1 text-sm text-vialto-steel">
          Comprobantes tipo 60 emitidos a transportistas vía ARCA.
        </p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {rows === null && !error && (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="border border-black/10 bg-white px-6 py-10 text-center">
          <p className="text-sm text-vialto-steel">
            Todavía no hay liquidaciones. Creá una desde las acciones de un viaje.
          </p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="overflow-x-auto border border-black/10 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-vialto-mist/60">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-vialto-steel">
                  Transportista
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-vialto-steel">
                  Período
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-vialto-steel">
                  Viajes
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-vialto-steel">
                  Bruto
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-vialto-steel">
                  Comisión
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-vialto-steel">
                  Líquido
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-vialto-steel">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-vialto-steel">
                  CAE
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((liq) => {
                const isBusy = busyId === liq.id;
                const isDownloading = downloading === liq.id;
                const puedeEmitir = liq.estado === 'borrador' || liq.estado === 'error';
                const puedeEliminar = liq.estado === 'borrador' || liq.estado === 'error' || liq.estado === 'pendiente_cae';
                const puedeAnular = liq.estado === 'autorizado';
                const tienePdf = liq.estado === 'autorizado' || liq.estado === 'anulado';

                return (
                  <tr key={liq.id} className="hover:bg-vialto-mist/30">
                    <td className="px-4 py-3 text-vialto-charcoal">
                      <p className="font-medium">{liq.transportista?.nombre ?? liq.transportistaId}</p>
                      {liq.transportista?.idFiscal && (
                        <p className="text-xs text-vialto-steel">{liq.transportista.idFiscal}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-vialto-steel whitespace-nowrap">
                      {fmtDate(liq.periodoDesde)} — {fmtDate(liq.periodoHasta)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-vialto-charcoal">
                      {liq.cantViajes}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-vialto-charcoal">
                      {fmtMoney(liq.bruto)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-vialto-steel">
                      {fmtMoney(liq.comision)}
                      <span className="ml-1 text-xs">({liq.comisionPct}%)</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-vialto-charcoal">
                      {fmtMoney(liq.liquido)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${ESTADO_CLASS[liq.estado]}`}>
                        {ESTADO_LABEL[liq.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-vialto-steel">
                      {liq.cae ? (
                        <div>
                          <p className="font-mono">{liq.cae}</p>
                          {liq.caeFechaVto && (
                            <p className="text-[11px]">Vto: {fmtDate(liq.caeFechaVto)}</p>
                          )}
                        </div>
                      ) : liq.arcaError ? (
                        <p className="text-red-600 text-[11px] max-w-[180px] truncate" title={liq.arcaError}>
                          {liq.arcaError}
                        </p>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {puedeEmitir && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void emitirArca(liq)}
                            className="h-7 px-3 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-40"
                          >
                            {isBusy ? '…' : 'Emitir'}
                          </button>
                        )}
                        {tienePdf && (
                          <button
                            type="button"
                            disabled={isDownloading}
                            onClick={() => void descargarPdf(liq)}
                            className="h-7 px-3 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-40"
                          >
                            {isDownloading ? '…' : 'PDF'}
                          </button>
                        )}
                        {puedeAnular && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void anular(liq)}
                            className="h-7 px-3 border border-red-200 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-40"
                          >
                            {isBusy ? '…' : 'Anular'}
                          </button>
                        )}
                        {puedeEliminar && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void eliminar(liq)}
                            className="h-7 px-3 border border-red-200 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50 disabled:opacity-40"
                          >
                            {isBusy ? '…' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                      {actionError?.id === liq.id && (
                        <p className="mt-1 text-right text-xs text-red-700">{actionError.msg}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
