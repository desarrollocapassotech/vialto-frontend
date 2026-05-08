import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import type { Viaje } from '@/types/api';
import { viajePermiteGenerarMicCrt } from '@/lib/viajesEstados';

type Props = {
  viaje: Viaje;
  onClose: () => void;
};

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ExportarViajeModal({ viaje, onClose }: Props) {
  const { getToken } = useAuth();
  const [generandoPaut, setGenerandoPaut] = useState(false);
  const [generandoMicCrt, setGenerandoMicCrt] = useState(false);
  const [error, setError] = useState<{ message: string; groups?: Record<string, string[]> } | null>(null);

  const permiteMicCrt = viajePermiteGenerarMicCrt(viaje.estado);
  const generando = generandoPaut || generandoMicCrt;

  type DescargaError = { message: string; groups?: Record<string, string[]> };

  async function descargarPdf(endpoint: string, filename: string): Promise<DescargaError | null> {
    try {
      const token = await getToken();
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string; missingGroups?: Record<string, string[]> };
        return { message: data.message ?? 'No se pudo generar el documento', groups: data.missingGroups };
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
      return { message: e instanceof Error ? e.message : 'Error de red al generar el documento.' };
    }
  }

  async function handlePaut() {
    setError(null);
    setGenerandoPaut(true);
    const err = await descargarPdf(`/api/viajes/${viaje.id}/paut`, `PAUT-${viaje.numero}.pdf`);
    setGenerandoPaut(false);
    if (err) setError(err);
  }

  async function handleMicCrt() {
    setError(null);
    setGenerandoMicCrt(true);
    const err = await descargarPdf(`/api/viajes/${viaje.id}/mic-crt`, `MIC-CRT-${viaje.numero}.pdf`);
    setGenerandoMicCrt(false);
    if (err) setError(err);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exportar-title"
    >
      <div className="w-full max-w-sm border border-black/15 bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="exportar-title"
              className="text-sm font-semibold text-vialto-charcoal"
            >
              Exportar
            </h2>
            <p className="mt-0.5 text-xs text-vialto-steel">
              Viaje #{viaje.numero}
            </p>
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
            disabled={generando}
            className="shrink-0 text-vialto-steel hover:text-vialto-charcoal disabled:opacity-40"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={generando}
            onClick={() => void handlePaut()}
            className="flex items-center justify-between border border-black/15 px-4 py-3 text-left hover:bg-vialto-mist disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-sm font-medium text-vialto-charcoal">
              {generandoPaut ? 'Generando…' : 'PAUT'}
            </span>
            {!generandoPaut && (
              <span className="text-xs text-vialto-steel">↓ PDF</span>
            )}
          </button>

          <button
            type="button"
            disabled={generando || !permiteMicCrt}
            onClick={() => void handleMicCrt()}
            className="flex items-center justify-between border border-black/15 px-4 py-3 text-left hover:bg-vialto-mist disabled:opacity-50 disabled:cursor-not-allowed"
            title={!permiteMicCrt ? 'Disponible una vez que el viaje esté finalizado' : undefined}
          >
            <span className="text-sm font-medium text-vialto-charcoal">
              {generandoMicCrt ? 'Generando…' : 'MIC/CRT'}
            </span>
            {!generandoMicCrt && (
              <span className="text-xs text-vialto-steel">
                {permiteMicCrt ? '↓ PDF' : 'No disponible'}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            <p className="font-semibold">{error.message}</p>
            {error.groups && Object.keys(error.groups).length > 0 && (
              <div className="mt-2 space-y-2">
                {Object.entries(error.groups).map(([group, fields]) => (
                  <div key={group}>
                    <p className="font-semibold uppercase tracking-wide text-[10px] text-red-600">{group}</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {fields.map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <span className="mt-px shrink-0 text-red-400">·</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={generando}
            onClick={onClose}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
