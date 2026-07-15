import { useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { isComprobanteFile } from '@/lib/comprobanteUpload';

const LABEL =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';
const BTN =
  'inline-flex items-center gap-1.5 h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50';
const BTN_ACCION =
  'h-8 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT =
  '.pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';

export function ComprobanteAdjuntoField({
  file,
  existingUrl,
  onFileChange,
  onClearExisting,
  disabled = false,
  label = 'Comprobante',
  error,
}: {
  file: File | null;
  /** URL ya guardada (edición). */
  existingUrl?: string | null;
  onFileChange: (file: File | null) => void;
  onClearExisting?: () => void;
  disabled?: boolean;
  label?: string;
  error?: string | null;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const hasExisting = Boolean(existingUrl?.trim()) && !file;
  const hasSelection = Boolean(file) || hasExisting;

  function clearInput() {
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleSelect(next: File | null) {
    setLocalError(null);
    if (!next) {
      onFileChange(null);
      setPreviewOpen(false);
      clearInput();
      return;
    }
    if (!isComprobanteFile(next)) {
      setLocalError('Solo se permiten PDF o imágenes (JPG, PNG, WEBP).');
      clearInput();
      return;
    }
    if (next.size > MAX_BYTES) {
      setLocalError('El archivo no puede superar 10 MB.');
      clearInput();
      return;
    }
    onFileChange(next);
  }

  function handleQuitar() {
    setLocalError(null);
    setPreviewOpen(false);
    if (file) {
      onFileChange(null);
      clearInput();
      return;
    }
    onClearExisting?.();
  }

  const displayName = file?.name ?? (hasExisting ? 'Comprobante adjunto' : null);
  const errMsg = error ?? localError;

  return (
    <>
      <div className="space-y-1">
        <span className={LABEL}>{label}</span>

        {!hasSelection ? (
          <div className="flex flex-wrap items-start gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className={BTN}
            >
              <Upload className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Adjuntar archivo
            </button>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={ACCEPT}
              disabled={disabled}
              className="sr-only"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                if (selected) handleSelect(selected);
              }}
            />
            <p className="w-full text-xs text-vialto-steel">PDF o imagen, máximo 10 MB</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded border border-black/10 bg-vialto-mist/30 px-3 py-2">
            <span
              className="text-sm text-vialto-charcoal truncate max-w-full"
              title={displayName ?? undefined}
            >
              {displayName}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPreviewOpen(true)}
              className={BTN_ACCION}
            >
              Ver
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleQuitar}
              className="text-xs uppercase tracking-wider text-vialto-fire hover:underline disabled:opacity-50"
            >
              Quitar
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              disabled={disabled}
              className="sr-only"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                if (selected) handleSelect(selected);
              }}
            />
          </div>
        )}

        {errMsg && (
          <p className="text-xs font-medium text-red-600">{errMsg}</p>
        )}
      </div>

      {previewOpen && file && (
        <AdjuntoPreviewModal
          file={file}
          title="Comprobante"
          onClose={() => setPreviewOpen(false)}
        />
      )}
      {previewOpen && !file && existingUrl && (
        <AdjuntoPreviewModal
          url={existingUrl}
          title="Comprobante"
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
