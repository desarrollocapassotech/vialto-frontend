import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';

export function TomarFotoRemitoModal({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Tu navegador no permite usar la cámara desde la web.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        video.onloadedmetadata = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setVideoAspect(video.videoWidth / video.videoHeight);
          }
          void video.play().then(() => setReady(true)).catch(() => {
            setError('No se pudo iniciar la vista previa de la cámara.');
          });
        };
      } catch {
        setError('No se pudo acceder a la cámara. Revisá los permisos del navegador.');
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function calcVisibleCrop(
    videoWidth: number,
    videoHeight: number,
    containerWidth: number,
    containerHeight: number,
  ) {
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;

    if (videoAspect > containerAspect) {
      const cropWidth = videoHeight * containerAspect;
      return {
        sx: (videoWidth - cropWidth) / 2,
        sy: 0,
        sw: cropWidth,
        sh: videoHeight,
      };
    }

    const cropHeight = videoWidth / containerAspect;
    return {
      sx: 0,
      sy: (videoHeight - cropHeight) / 2,
      sw: videoWidth,
      sh: cropHeight,
    };
  }

  function handleCapture() {
    const video = videoRef.current;
    const viewport = viewportRef.current;
    if (!video || !viewport || !ready || video.videoWidth === 0 || video.videoHeight === 0) return;

    setCapturing(true);
    const { sx, sy, sw, sh } = calcVisibleCrop(
      video.videoWidth,
      video.videoHeight,
      viewport.clientWidth,
      viewport.clientHeight,
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCapturing(false);
      return;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setCapturing(false);
        if (!blob) {
          setError('No se pudo guardar la foto. Intentá de nuevo.');
          return;
        }
        const file = new File([blob], `remito-foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      },
      'image/jpeg',
      0.92,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="border-b border-black/10 px-5 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            Tomar foto del remito
          </h2>
        </div>

        <div className="px-5 py-4 space-y-3">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <div
              ref={viewportRef}
              className="mx-auto w-full max-h-[60vh] overflow-hidden rounded border border-black/10 bg-black"
              style={{ aspectRatio: videoAspect ?? 3 / 4 }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="block h-full w-full object-cover"
              />
            </div>
          )}
          {!error && !ready && (
            <p className="text-sm text-vialto-steel">Iniciando cámara…</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!ready || capturing || Boolean(error)}
            onClick={handleCapture}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            <Camera className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {capturing ? 'Guardando…' : 'Capturar'}
          </button>
        </div>
      </div>
    </div>
  );
}
