import { useEffect } from 'react';
import { Camera, FolderOpen } from 'lucide-react';

const OPCION =
  'group flex flex-col items-center justify-center gap-4 rounded-lg border border-black/15 bg-white p-8 sm:p-10 text-center transition-colors hover:border-vialto-fire/40 hover:bg-vialto-mist/50 disabled:opacity-50 disabled:pointer-events-none';

export function CargarRemitoModal({
  onClose,
  onBuscarArchivo,
  onTomarFoto,
  disabled = false,
}: {
  onClose: () => void;
  onBuscarArchivo: () => void;
  onTomarFoto: () => void;
  disabled?: boolean;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cargar-remito-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-lg border border-black/10 bg-white shadow-lg"
      >
        <div className="border-b border-black/10 px-6 py-5">
          <h2
            id="cargar-remito-modal-title"
            className="font-[family-name:var(--font-display)] text-xl sm:text-2xl tracking-wide"
          >
            Cargar remito
          </h2>
          <p className="mt-1 text-sm text-vialto-steel">
            Elegí cómo querés adjuntar el documento. PDF o imagen, máximo 10 MB.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-8">
          <button
            type="button"
            disabled={disabled}
            onClick={onBuscarArchivo}
            className={OPCION}
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-vialto-mist text-vialto-charcoal group-hover:bg-white group-hover:text-vialto-fire transition-colors">
              <FolderOpen className="h-10 w-10" strokeWidth={1.5} aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.12em] text-vialto-charcoal">
                Buscar archivo
              </span>
              <span className="mt-1 block text-xs text-vialto-steel normal-case tracking-normal">
                PDF o imagen desde tu dispositivo
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={onTomarFoto}
            className={OPCION}
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-vialto-mist text-vialto-charcoal group-hover:bg-white group-hover:text-vialto-fire transition-colors">
              <Camera className="h-10 w-10" strokeWidth={1.5} aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.12em] text-vialto-charcoal">
                Tomar foto
              </span>
              <span className="mt-1 block text-xs text-vialto-steel normal-case tracking-normal">
                Usá la cámara del celular o la webcam
              </span>
            </span>
          </button>
        </div>

        <div className="flex justify-end border-t border-black/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
