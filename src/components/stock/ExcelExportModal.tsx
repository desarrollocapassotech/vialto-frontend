import { useEffect, useRef, useState } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';

export interface ExcelExportColOption {
  id: string;
  label: string;
  required?: boolean;
}

interface Props {
  columns: ExcelExportColOption[];
  rowCount: number;
  onExport: (selectedIds: string[]) => void;
  onClose: () => void;
}

export function ExcelExportModal({ columns, rowCount, onExport, onClose }: Props) {
  const requiredCols = columns.filter((c) => c.required);
  const optionalCols = columns.filter((c) => !c.required);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(optionalCols.map((c) => c.id)),
  );

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
    setSelected(on ? new Set(optionalCols.map((c) => c.id)) : new Set());
  }

  const allOn = optionalCols.length > 0 && selected.size === optionalCols.length;
  const someOn = selected.size > 0 && !allOn;
  const noneOn = selected.size === 0 && requiredCols.length === 0;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someOn;
  }, [someOn]);

  function handleExport() {
    const optionalIds = optionalCols.map((c) => c.id).filter((id) => selected.has(id));
    const requiredIds = requiredCols.map((c) => c.id);
    const ids = [...requiredIds, ...optionalIds];
    if (ids.length === 0) return;
    onExport(ids);
    onClose();
  }

  return (
    <ViewModalShell
      title="Exportar"
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
          Elegí las columnas adicionales que querés incluir en el archivo.
        </p>

        {optionalCols.length > 0 && (
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-black/10 pb-2">
              <span className="flex items-center gap-3 text-sm font-medium text-vialto-charcoal">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allOn}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-vialto-charcoal"
                />
                Seleccionar todo
              </span>
              <span className="text-xs text-vialto-steel">
                {selected.size} de {optionalCols.length}
              </span>
            </label>

            <ul className="space-y-2">
              {optionalCols.map((col) => (
                <li key={col.id}>
                  <label className="flex cursor-pointer items-center gap-3 pl-0.5 text-sm text-vialto-charcoal">
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
        )}
      </div>
    </ViewModalShell>
  );
}
