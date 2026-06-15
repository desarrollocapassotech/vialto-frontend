import { useId, useRef, useState } from 'react';
import { Receipt, Upload } from 'lucide-react';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { CargarRemitoModal } from '@/components/stock/CargarRemitoModal';
import { GenerarRemitoArcaModal } from '@/components/stock/GenerarRemitoArcaModal';
import { TomarFotoRemitoModal } from '@/components/stock/TomarFotoRemitoModal';

const LABEL =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

const BTN =
  'inline-flex items-center gap-1.5 h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50';

const BTN_ACCION =
  'h-8 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50';

export function RemitoAdjuntoStock({
  file,
  onFileChange,
  labelClassName = LABEL,
  disabled = false,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  labelClassName?: string;
  disabled?: boolean;
}) {
  const archivoInputId = useId();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [modalCargar, setModalCargar] = useState(false);
  const [modalGenerar, setModalGenerar] = useState(false);
  const [modalFoto, setModalFoto] = useState(false);
  const [previewAbierto, setPreviewAbierto] = useState(false);

  function handleSelect(next: File | null) {
    onFileChange(next);
    if (!next) setPreviewAbierto(false);
    if (archivoRef.current) archivoRef.current.value = '';
  }

  return (
    <>
      <div className="space-y-1">
        <span className={labelClassName}>Remito <span className="text-red-500">*</span></span>

        {!file ? (
          <div className="flex flex-wrap items-start gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModalCargar(true)}
              className={BTN}
            >
              <Upload className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Cargar remito
            </button>
            <input
              ref={archivoRef}
              id={archivoInputId}
              type="file"
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
              disabled={disabled}
              className="sr-only"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                if (selected) handleSelect(selected);
              }}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModalGenerar(true)}
              className={BTN}
            >
              <Receipt className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Generar remito
            </button>
            <p className="w-full text-xs text-vialto-steel">PDF o imagen, máximo 10 MB</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded border border-black/10 bg-vialto-mist/30 px-3 py-2">
            <span className="text-sm text-vialto-charcoal truncate max-w-full" title={file.name}>
              {file.name}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPreviewAbierto(true)}
              className={BTN_ACCION}
            >
              Ver
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(null)}
              className="text-xs uppercase tracking-wider text-vialto-fire hover:underline disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        )}
      </div>

      {modalCargar && (
        <CargarRemitoModal
          disabled={disabled}
          onClose={() => setModalCargar(false)}
          onBuscarArchivo={() => {
            setModalCargar(false);
            archivoRef.current?.click();
          }}
          onTomarFoto={() => {
            setModalCargar(false);
            setModalFoto(true);
          }}
        />
      )}

      {modalGenerar && (
        <GenerarRemitoArcaModal
          disabled={disabled}
          onClose={() => setModalGenerar(false)}
          onCargarRemito={() => {
            setModalGenerar(false);
            setModalCargar(true);
          }}
        />
      )}

      {modalFoto && (
        <TomarFotoRemitoModal
          onClose={() => setModalFoto(false)}
          onCapture={(captured) => handleSelect(captured)}
        />
      )}

      {previewAbierto && file && (
        <AdjuntoPreviewModal
          file={file}
          title="Remito"
          onClose={() => setPreviewAbierto(false)}
        />
      )}
    </>
  );
}
