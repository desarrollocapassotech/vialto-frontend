import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '@/components/ui/Spinner';
import {
  contentTypeFromFile,
  detectarTipoAdjuntoDesdeContentType,
  pdfEmbedSrc,
} from '@/lib/adjuntoPreview';
import { fetchRemitoAdjuntoBlob } from '@/lib/stockRemitoAdjunto';
import { AdjuntoImagenZoomView } from './AdjuntoImagenZoomView';

/** Ancho del panel según alto útil y proporción A4 vertical. */
const PDF_PANEL_WIDTH =
  'min(calc((100vh - 5.5rem) * 210 / 297), calc(100vw - 2rem))';

export function AdjuntoPreviewModal({
  movimientoId,
  tenantId,
  file,
  title = 'Vista previa',
  onClose,
}: {
  /** Remito ya guardado en el servidor. */
  movimientoId?: string;
  tenantId?: string;
  /** Archivo local seleccionado antes de subir. */
  file?: File;
  title?: string;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>('application/pdf');
  const [loading, setLoading] = useState(!file);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      setContentType(contentTypeFromFile(file));
      setLoading(false);
      setError(null);
      return () => URL.revokeObjectURL(url);
    }

    if (!movimientoId) {
      setError('No hay adjunto para mostrar.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let revokeUrl: string | null = null;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await fetchRemitoAdjuntoBlob(movimientoId, getToken, tenantId);
        if (cancelled) {
          URL.revokeObjectURL(loaded.objectUrl);
          return;
        }
        revokeUrl = loaded.objectUrl;
        setObjectUrl(loaded.objectUrl);
        setContentType(loaded.contentType);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el adjunto.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [file, getToken, movimientoId, tenantId]);

  const tipo = objectUrl ? detectarTipoAdjuntoDesdeContentType(contentType) : 'pdf';
  const previewSrc = objectUrl && tipo !== 'imagen' ? pdfEmbedSrc(objectUrl) : objectUrl;
  const isPdf = tipo !== 'imagen';

  const modal = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-2xl"
        style={{ width: PDF_PANEL_WIDTH }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-base sm:text-lg tracking-wide truncate min-w-0">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
          >
            Cerrar
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col bg-white">
          {loading && (
            <div className="flex flex-1 items-center justify-center gap-2 px-6 text-sm text-vialto-steel">
              <Spinner />
              Cargando adjunto…
            </div>
          )}
          {error && (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            </div>
          )}
          {!loading && !error && objectUrl && tipo === 'imagen' && (
            <AdjuntoImagenZoomView src={objectUrl} alt={title} />
          )}
          {!loading && !error && previewSrc && isPdf && (
            <iframe
              src={previewSrc}
              title={title}
              className="h-full w-full min-h-0 flex-1 border-0 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
