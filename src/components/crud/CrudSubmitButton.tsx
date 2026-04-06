interface CrudSubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
  /** Si es false, el botón no se atenúa al guardar (el padre debe evitar doble envío). */
  disableWhileLoading?: boolean;
}

export function CrudSubmitButton({
  loading,
  label,
  loadingLabel = 'Guardando…',
  disableWhileLoading = true,
}: CrudSubmitButtonProps) {
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={disableWhileLoading ? loading : false}
        className="h-10 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider disabled:opacity-50"
      >
        {loading ? loadingLabel : label}
      </button>
    </div>
  );
}
