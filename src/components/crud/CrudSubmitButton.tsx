import { Spinner } from '@/components/ui/Spinner';

interface CrudSubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
  /** Si es false, el botón no se atenúa al guardar (el padre debe evitar doble envío). */
  disableWhileLoading?: boolean;
  /** Deshabilita el botón independientemente del estado de carga. */
  disabled?: boolean;
  /** Clase de altura del botón. Default: 'h-10' (comportamiento histórico). */
  className?: string;
}

export function CrudSubmitButton({
  loading,
  label,
  loadingLabel = 'Guardando…',
  disableWhileLoading = true,
  disabled = false,
  className = 'h-10',
}: CrudSubmitButtonProps) {
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={disabled || (disableWhileLoading ? loading : false)}
        className={`inline-flex items-center gap-2 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider disabled:opacity-50 ${className}`}
      >
        {loading && <Spinner />}
        {loading ? loadingLabel : label}
      </button>
    </div>
  );
}
