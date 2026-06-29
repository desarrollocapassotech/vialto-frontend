import { useAuth } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import type { Viaje, Chofer } from '@/types/api';
import { viajePermiteGenerarMicCrt } from '@/lib/viajesEstados';
import { viajeUsaFlotaPropia } from '@/lib/viajesGananciaBruta';
import { apiFetch, apiJson } from '@/lib/api';
import { MicCrtExportModal } from '@/components/viajes/MicCrtExportModal';
import { ViajeExportMissingFieldsPanel } from '@/components/viajes/ViajeExportMissingFieldsPanel';
import {
  mensajeBloqueoMicCrt,
  missingGroupsMicCrtDesdeViaje,
  type ViajeExportMissingGroup,
} from '@/lib/viajeExportMissingFields';

type Props = {
  viaje: Viaje;
  onClose: () => void;
  tenantId?: string;
};

type DescargaError = {
  message: string;
  groups?: Record<string, ViajeExportMissingGroup>;
  endpoint: string;
  filename: string;
};

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ExportarViajeModal({ viaje: viajeProp, onClose, tenantId }: Props) {
  const { getToken } = useAuth();
  const tid = tenantId?.trim() ?? '';
  const platform = Boolean(tid);

  const [viaje, setViaje] = useState(viajeProp);
  useEffect(() => {
    setViaje(viajeProp);
  }, [viajeProp]);

  function maestroPatchUrl(apiModule: string, entityId: string) {
    if (platform) {
      return `/api/platform/${apiModule}/${encodeURIComponent(entityId)}?tenantId=${encodeURIComponent(tid)}`;
    }
    return `/api/${apiModule}/${encodeURIComponent(entityId)}`;
  }

  function viajeDetailUrl() {
    if (platform) {
      return `/api/platform/viajes/${encodeURIComponent(viaje.id)}?tenantId=${encodeURIComponent(tid)}`;
    }
    return `/api/viajes/${encodeURIComponent(viaje.id)}`;
  }

  function viajePdfUrl(suffix: 'paut' | 'mic-crt') {
    if (platform) {
      return `/api/platform/viajes/${encodeURIComponent(viaje.id)}/${suffix}?tenantId=${encodeURIComponent(tid)}`;
    }
    return `/api/viajes/${encodeURIComponent(viaje.id)}/${suffix}`;
  }

  const [generandoPaut, setGenerandoPaut] = useState(false);
  const [micCrtValidando, setMicCrtValidando] = useState(false);
  const [micCrtAbierto, setMicCrtAbierto] = useState(false);
  const [micCrtBloqueo, setMicCrtBloqueo] = useState<Record<string, ViajeExportMissingGroup> | null>(null);
  const [error, setError] = useState<DescargaError | null>(null);
  const [guardando, setGuardando] = useState(false);

  const permiteMicCrt = viajePermiteGenerarMicCrt(viaje.estado);
  const permitePaut = !viajeUsaFlotaPropia(viaje);
  const ocupado = generandoPaut || guardando || micCrtValidando;

  async function refetchViaje(): Promise<Viaje> {
    const v = await apiJson<Viaje>(viajeDetailUrl(), getToken);
    setViaje(v);
    return v;
  }

  async function validarRequisitosMicCrt(v: Viaje): Promise<Record<string, ViajeExportMissingGroup> | null> {
    const groups = missingGroupsMicCrtDesdeViaje(v);
    if (groups) return groups;

    const choferId = v.choferId?.trim();
    if (choferId && !v.chofer?.dni?.trim()) {
      if (v.chofer) {
        return { Chofer: { fields: ['DNI'], entityId: choferId } };
      }
      try {
        const chofer = await apiJson<Chofer>(maestroPatchUrl('choferes', choferId), getToken);
        if (!chofer.dni?.trim()) {
          return { Chofer: { fields: ['DNI'], entityId: choferId } };
        }
      } catch {
        /* si no se puede verificar, dejar pasar y el backend validará */
      }
    }
    return null;
  }

  async function abrirMicCrt() {
    setMicCrtBloqueo(null);
    setMicCrtValidando(true);
    try {
      const groups = await validarRequisitosMicCrt(viaje);
      if (groups) {
        setMicCrtBloqueo(groups);
        return;
      }
      setMicCrtAbierto(true);
    } finally {
      setMicCrtValidando(false);
    }
  }

  async function descargarPdf(endpoint: string, filename: string): Promise<DescargaError | null> {
    try {
      const res = await apiFetch(endpoint, getToken, { cache: 'no-store' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          missingGroups?: Record<string, ViajeExportMissingGroup>;
        };
        return {
          message: data.message ?? 'No se pudo generar el documento',
          groups: data.missingGroups,
          endpoint,
          filename,
        };
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return null;
    } catch (e) {
      return {
        message: e instanceof Error ? e.message : 'Error de red al generar el documento.',
        endpoint,
        filename,
      };
    }
  }

  async function ejecutarDescarga(endpoint: string, filename: string, setGenerando: (v: boolean) => void) {
    setError(null);
    setGenerando(true);
    const err = await descargarPdf(endpoint, filename);
    setGenerando(false);
    if (err) setError(err);
  }

  async function reintentarPautTrasCorreccion() {
    if (!error) return;
    setGuardando(true);
    try {
      await refetchViaje();
      setError(null);
      setGenerandoPaut(true);
      const retryErr = await descargarPdf(error.endpoint, error.filename);
      setGenerandoPaut(false);
      if (retryErr) setError(retryErr);
    } finally {
      setGuardando(false);
    }
  }

  async function reintentarMicTrasCorreccion() {
    setMicCrtBloqueo(null);
    const v = await refetchViaje();
    const groups = await validarRequisitosMicCrt(v);
    if (groups) {
      setMicCrtBloqueo(groups);
      return;
    }
    setMicCrtAbierto(true);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exportar-title"
      >
        <div className="w-full max-w-sm border border-black/15 bg-white p-5 shadow-lg overflow-y-auto max-h-[90vh]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="exportar-title" className="text-sm font-semibold text-vialto-charcoal">
                Exportar
              </h2>
              <p className="mt-0.5 text-xs text-vialto-steel">Viaje #{viaje.numero}</p>
              {(viaje.origen || viaje.destino) && (
                <p className="mt-1 text-xs text-vialto-steel">
                  {[viaje.origen, viaje.destino].filter(Boolean).join(' → ')}
                </p>
              )}
              {(viaje.fechaCarga || viaje.fechaDescarga) && (
                <p className="mt-0.5 text-xs text-vialto-steel">
                  {fmtFecha(viaje.fechaCarga)}
                  {viaje.fechaCarga && viaje.fechaDescarga && ' – '}
                  {fmtFecha(viaje.fechaDescarga)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={ocupado}
              className="shrink-0 text-vialto-steel hover:text-vialto-charcoal disabled:opacity-40"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {permitePaut ? (
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  void ejecutarDescarga(viajePdfUrl('paut'), `NOMINA-${viaje.numero}.pdf`, setGenerandoPaut)
                }
                className="flex items-center justify-between border border-black/15 px-4 py-3 text-left hover:bg-vialto-mist disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm font-medium text-vialto-charcoal">
                  {generandoPaut ? 'Generando…' : 'NOMINA'}
                </span>
                {!generandoPaut && <span className="text-xs text-vialto-steel">↓ PDF</span>}
              </button>
            ) : null}

            <button
              type="button"
              disabled={ocupado || !permiteMicCrt}
              onClick={() => void abrirMicCrt()}
              className="flex items-center justify-between border border-black/15 px-4 py-3 text-left hover:bg-vialto-mist disabled:opacity-50 disabled:cursor-not-allowed"
              title={!permiteMicCrt ? 'No disponible para viajes cancelados' : undefined}
            >
              <span className="text-sm font-medium text-vialto-charcoal">
                {micCrtValidando ? 'Verificando…' : 'MIC/CRT'}
              </span>
              <span className="text-xs text-vialto-steel">
                {permiteMicCrt ? (micCrtValidando ? <Spinner className="h-3.5 w-3.5" /> : 'Formulario') : 'No disponible'}
              </span>
            </button>
          </div>

          {micCrtBloqueo && (
            <div className="mt-4">
              <ViajeExportMissingFieldsPanel
                viaje={viaje}
                tenantId={tenantId}
                message={mensajeBloqueoMicCrt(micCrtBloqueo)}
                groups={micCrtBloqueo}
                disabled={ocupado}
                saveLabel="Guardar y continuar"
                onSaved={() => void reintentarMicTrasCorreccion()}
              />
            </div>
          )}

          {error?.groups && Object.keys(error.groups).length > 0 ? (
            <div className="mt-4">
              <ViajeExportMissingFieldsPanel
                viaje={viaje}
                tenantId={tenantId}
                message={error.message}
                groups={error.groups}
                disabled={ocupado}
                onSaved={() => void reintentarPautTrasCorreccion()}
              />
            </div>
          ) : error ? (
            <div className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              <p className="font-semibold">{error.message}</p>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={ocupado}
              onClick={onClose}
              className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {micCrtAbierto && (
        <MicCrtExportModal
          viaje={viaje}
          tenantId={tenantId}
          onClose={() => setMicCrtAbierto(false)}
          onViajeUpdated={() => void refetchViaje()}
        />
      )}
    </>
  );
}
