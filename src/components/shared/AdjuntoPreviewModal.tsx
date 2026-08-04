import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import {
  contentTypeFromFile,
  detectarTipoAdjunto,
  detectarTipoAdjuntoDesdeContentType,
  pdfEmbedSrc,
  type AdjuntoPreviewTipo,
} from '@/lib/adjuntoPreview';
import { fetchRemitoAdjuntoBlob } from '@/lib/stockRemitoAdjunto';
import { AdjuntoImagenZoomView } from './AdjuntoImagenZoomView';

/** Ancho del panel de imágenes según alto útil y proporción A4 vertical. */
const IMAGEN_PANEL_WIDTH =
  'min(calc((100vh - 5.5rem) * 210 / 297), calc(100vw - 2rem))';

/** Por encima de view (z-50) y edición (z-110). */
const PREVIEW_Z = 'z-[130]';

function nombreDesdeUrl(url: string, tipo: AdjuntoPreviewTipo): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').filter(Boolean).pop();
    if (last) {
      const decoded = decodeURIComponent(last);
      if (/\.[a-z0-9]{2,5}$/i.test(decoded)) {
        return decoded;
      }
      if (tipo === 'pdf') return `${decoded}.pdf`;
      if (tipo === 'imagen') return `${decoded}.jpg`;
    }
  } catch {
    /* ignore */
  }
  if (tipo === 'imagen') return 'comprobante.jpg';
  return 'comprobante.pdf';
}

/**
 * Cloudinary (raw/PDF) suele forzar descarga si se usa la URL directa en un iframe.
 * Traemos el archivo como blob y lo previsualizamos con object URL same-origin.
 */
async function fetchUrlComoBlob(url: string): Promise<{
  objectUrl: string;
  contentType: string;
  blob: Blob;
}> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) {
    throw new Error('No se pudo cargar el comprobante.');
  }
  const raw = await res.blob();
  const tipoUrl = detectarTipoAdjunto(url);
  let contentType =
    res.headers.get('content-type')?.split(';')[0]?.trim() ||
    raw.type ||
    '';

  if (!contentType || contentType === 'application/octet-stream') {
    contentType =
      tipoUrl === 'imagen'
        ? 'image/jpeg'
        : tipoUrl === 'pdf'
          ? 'application/pdf'
          : 'application/pdf';
  }

  // Asegurar MIME correcto para el visor embebido del navegador.
  if (
    (tipoUrl === 'pdf' || contentType.includes('pdf')) &&
    !contentType.includes('pdf')
  ) {
    contentType = 'application/pdf';
  }

  const blob =
    raw.type === contentType ? raw : new Blob([raw], { type: contentType });
  return {
    objectUrl: URL.createObjectURL(blob),
    contentType,
    blob,
  };
}

function descargarObjectUrl(objectUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function AdjuntoPreviewModal({
  movimientoId,
  tenantId,
  file,
  url,
  title = 'Vista previa',
  onClose,
}: {
  /** Remito ya guardado en el servidor (streaming por backend). */
  movimientoId?: string;
  tenantId?: string;
  /** URL directa (Cloudinary) de un comprobante guardado. */
  url?: string;
  /** Archivo local seleccionado antes de subir. */
  file?: File;
  title?: string;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>('application/pdf');
  const [loading, setLoading] = useState(true);
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
    let cancelled = false;
    let revokeUrl: string | null = null;

    void (async () => {
      setLoading(true);
      setError(null);
      setObjectUrl(null);

      try {
        if (file) {
          const localUrl = URL.createObjectURL(file);
          if (cancelled) {
            URL.revokeObjectURL(localUrl);
            return;
          }
          revokeUrl = localUrl;
          setObjectUrl(localUrl);
          setContentType(contentTypeFromFile(file));
          return;
        }

        if (url) {
          const loaded = await fetchUrlComoBlob(url);
          if (cancelled) {
            URL.revokeObjectURL(loaded.objectUrl);
            return;
          }
          revokeUrl = loaded.objectUrl;
          setObjectUrl(loaded.objectUrl);
          setContentType(loaded.contentType);
          return;
        }

        if (!movimientoId) {
          throw new Error('No hay adjunto para mostrar.');
        }

        const loaded = await fetchRemitoAdjuntoBlob(
          movimientoId,
          getToken,
          tenantId,
        );
        if (cancelled) {
          URL.revokeObjectURL(loaded.objectUrl);
          return;
        }
        revokeUrl = loaded.objectUrl;
        setObjectUrl(loaded.objectUrl);
        setContentType(loaded.contentType);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'No se pudo cargar el adjunto.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [file, url, getToken, movimientoId, tenantId]);

  const tipo: AdjuntoPreviewTipo = useMemo(() => {
    const fromCt = detectarTipoAdjuntoDesdeContentType(contentType);
    if (fromCt !== 'desconocido') return fromCt;
    if (file) {
      return detectarTipoAdjuntoDesdeContentType(contentTypeFromFile(file));
    }
    if (url) return detectarTipoAdjunto(url);
    return 'pdf';
  }, [contentType, file, url]);

  const isPdf = tipo !== 'imagen';
  const previewSrc =
    objectUrl && isPdf ? pdfEmbedSrc(objectUrl) : objectUrl;
  const esPantallaCompleta = isPdf || Boolean(movimientoId);

  const downloadName = useMemo(() => {
    if (file?.name) return file.name;
    if (url) return nombreDesdeUrl(url, tipo);
    return tipo === 'imagen' ? 'comprobante.jpg' : 'comprobante.pdf';
  }, [file, url, tipo]);

  const modal = (
    <div
      className={`fixed inset-0 ${PREVIEW_Z} flex bg-black/60 ${
        esPantallaCompleta ? '' : 'items-center justify-center p-4'
      }`}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-col overflow-hidden bg-white shadow-2xl ${
          esPantallaCompleta
            ? 'h-screen w-screen max-h-screen max-w-none rounded-none'
            : 'h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] rounded-lg border border-black/10'
        }`}
        style={esPantallaCompleta ? undefined : { width: IMAGEN_PANEL_WIDTH }}
      >
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 ${
            esPantallaCompleta ? 'py-2.5' : 'py-3'
          }`}
        >
          <h2 className="font-[family-name:var(--font-display)] text-base sm:text-lg tracking-wide truncate min-w-0">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {objectUrl && !loading && !error && (
              <button
                type="button"
                onClick={() => descargarObjectUrl(objectUrl, downloadName)}
                className="inline-flex h-9 items-center gap-1.5 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Descargar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
            >
              Cerrar
            </button>
          </div>
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
