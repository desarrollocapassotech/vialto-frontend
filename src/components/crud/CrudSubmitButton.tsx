interface CrudSubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
}

export function CrudSubmitButton({
  loading,
  label,
  loadingLabel = 'Guardando…',
}: CrudSubmitButtonProps) {
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={loading}
        className="h-10 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider disabled:opacity-50"
      >
        {loading ? loadingLabel : label}
      </button>
    </div>
  );
}
