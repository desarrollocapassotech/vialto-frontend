import { CrudInput } from '@/components/crud/CrudFields';

interface CrudDangerZoneProps {
  message: string;
  confirmValue: string;
  onConfirmValueChange: (value: string) => void;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
  deleteLabel: string;
  deletingLabel?: string;
}

export function CrudDangerZone({
  message,
  confirmValue,
  onConfirmValueChange,
  canDelete,
  deleting,
  onDelete,
  deleteLabel,
  deletingLabel = 'Eliminando…',
}: CrudDangerZoneProps) {
  return (
    <section className="mt-10 border border-red-300 bg-red-50 p-5">
      <h2 className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-red-800">
        Danger Zone
      </h2>
      <p className="mt-2 text-sm text-red-900">{message}</p>
      <CrudInput
        className="mt-3 w-full border-red-300"
        value={confirmValue}
        onChange={(e) => onConfirmValueChange(e.target.value)}
      />
      <button
        type="button"
        disabled={!canDelete || deleting}
        onClick={onDelete}
        className="mt-3 h-10 px-4 bg-red-700 text-white text-sm uppercase tracking-wider disabled:opacity-50"
      >
        {deleting ? deletingLabel : deleteLabel}
      </button>
    </section>
  );
}
