type ViajeKmLitrosDialogProps = {
  open: boolean;
  title: string;
  km: string;
  litros: string;
  error: string | null;
  busy?: boolean;
  onKmChange: (v: string) => void;
  onLitrosChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ViajeKmLitrosDialog({
  open,
  title,
  km,
  litros,
  error,
  busy = false,
  onKmChange,
  onLitrosChange,
  onConfirm,
  onCancel,
}: ViajeKmLitrosDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="viaje-km-litros-title"
    >
      <div className="w-full max-w-md rounded border border-black/15 bg-white p-5 shadow-lg">
        <h2 id="viaje-km-litros-title" className="text-sm font-semibold text-vialto-charcoal">
          {title}
        </h2>
        <p className="mt-2 text-xs text-vialto-steel">
          Podés cargar km recorridos y litros consumidos si los tenés; también podés continuar sin
          completarlos.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
              Km recorridos
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={km}
              onChange={(e) => onKmChange(e.target.value)}
              disabled={busy}
              className="h-9 border border-black/15 bg-white px-2 text-sm"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
              Litros consumidos
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={litros}
              onChange={(e) => onLitrosChange(e.target.value)}
              disabled={busy}
              className="h-9 border border-black/15 bg-white px-2 text-sm"
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
