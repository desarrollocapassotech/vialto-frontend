import { Spinner } from '@/components/ui/Spinner';

interface CrudSubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
  /** Si es false, el botón no se atenúa al guardar (el padre debe evitar doble envío). */
  disableWhileLoading?: boolean;
  /** Deshabilita el botón independientemente del estado de carga. */
  disabled?: boolean;
}

export function CrudSubmitButton({
  loading,
  label,
  loadingLabel = 'Guardando…',
  disableWhileLoading = true,
  disabled = false,
}: CrudSubmitButtonProps) {
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={disabled || (disableWhileLoading ? loading : false)}
        className="inline-flex items-center gap-2 h-10 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider disabled:opacity-50"
      >
        {loading && <Spinner />}
        {loading ? loadingLabel : label}
      </button>
    </div>
  );
}
