import { useRef } from 'react';
import { isIngresoFotoFile } from '@/lib/stockRemitoUpload';
import { STOCK_FORM_LABEL as LABEL } from '@/lib/stockFormLayout';

const MAX_FOTOS = 2;
const ACCEPT_FOTOS = 'image/jpeg,image/png,.jpg,.jpeg,.png';
const BTN_SM =
  'h-10 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50 sm:h-8';
const BTN_SM_DANGER =
  'h-10 px-3 text-xs uppercase tracking-wider border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 sm:h-8';

export function FotosIngresoField({
  files,
  onChange,
  onPreview,
  disabled,
  error,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  onPreview: (file: File) => void;
  disabled: boolean;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).filter(isIngresoFotoFile);
    const combined = [...files, ...selected].slice(0, MAX_FOTOS);
    onChange(combined);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  const canAdd = files.length < MAX_FOTOS;

  return (
    <div className="space-y-1">
      <span className={LABEL}>
        Fotos del producto
        <span className="ml-1 normal-case font-normal text-vialto-steel">(máx. 2 imágenes JPG/PNG)</span>
      </span>

      <div className="space-y-2">
        {files.map((file, idx) => (
          <div
            key={`${file.name}-${idx}`}
            className="flex items-center gap-2 rounded border border-black/10 bg-vialto-mist/30 px-3 py-2"
          >
            <span className="text-sm text-vialto-charcoal truncate flex-1 min-w-0" title={file.name}>
              Foto {idx + 1} — {file.name}
            </span>
            <button type="button" disabled={disabled} onClick={() => onPreview(file)} className={BTN_SM}>
              Ver
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeFile(idx)}
              className={BTN_SM_DANGER}
            >
              Quitar
            </button>
          </div>
        ))}

        {canAdd && (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-11 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50 sm:h-9"
            >
              + Agregar foto
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_FOTOS}
              className="sr-only"
              onChange={handleSelect}
            />
          </>
        )}
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
