import { useEffect, useState } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';

export interface ExcelExportColOption {
  id: string;
  label: string;
}

interface Props {
  columns: ExcelExportColOption[];
  rowCount: number;
  onExport: (selectedIds: string[]) => void;
  onClose: () => void;
}

export function ExcelExportModal({ columns, rowCount, onExport, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(columns.map((c) => c.id)));

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(columns.map((c) => c.id)) : new Set());
  }

  const allOn = selected.size === columns.length;
  const noneOn = selected.size === 0;

  function handleExport() {
    const ids = columns.map((c) => c.id).filter((id) => selected.has(id));
    if (ids.length === 0) return;
    onExport(ids);
    onClose();
  }

  return (
    <ViewModalShell
      title="Descargar Excel"
      onClose={onClose}
      maxWidthClass="sm:max-w-sm"
      scrollBody
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={noneOn}
            className={`${viewModalBtnPrimary} disabled:opacity-40`}
          >
            Descargar ({rowCount} {rowCount === 1 ? 'fila' : 'filas'})
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-vialto-steel">
          Elegí las columnas que querés incluir en el archivo.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => toggleAll(true)}
            disabled={allOn}
            className="text-xs text-vialto-fire hover:underline disabled:opacity-40"
          >
            Seleccionar todas
          </button>
          <button
            type="button"
            onClick={() => toggleAll(false)}
            disabled={noneOn}
            className="text-xs text-vialto-steel hover:underline disabled:opacity-40"
          >
            Deseleccionar todas
          </button>
        </div>

        <ul className="space-y-2">
          {columns.map((col) => (
            <li key={col.id}>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-vialto-charcoal">
                <input
                  type="checkbox"
                  checked={selected.has(col.id)}
                  onChange={() => toggle(col.id)}
                  className="h-4 w-4 shrink-0 accent-vialto-charcoal"
                />
                {col.label}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </ViewModalShell>
  );
}
