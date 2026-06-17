import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import type { PaisCodigo } from '@/lib/ciudades';
import { emptyDestinoRow, type ViajeDestinoRowDraft } from '@/lib/viajesDestinos';

const LABEL =
  'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';

type Props = {
  rows: ViajeDestinoRowDraft[];
  onChange: (rows: ViajeDestinoRowDraft[]) => void;
  inputClassName: string;
  /** Para ids accesibles únicos entre formularios. */
  groupId: string;
  disableBrowserAutocomplete?: boolean;
};

export function ViajeDestinosLista({
  rows,
  onChange,
  inputClassName,
  groupId,
  disableBrowserAutocomplete,
}: Props) {
  function setRow(i: number, patch: Partial<ViajeDestinoRowDraft>) {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const pais = rows[rows.length - 1]?.pais ?? 'AR';
    onChange([...rows, emptyDestinoRow(pais)]);
  }

  function removeRow(i: number) {
    if (i === 0 || rows.length <= 1) return;
    onChange(rows.filter((_, j) => j !== i));
  }

  return (
    <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <span className={LABEL}>Destinos</span>
        <button
          type="button"
          onClick={addRow}
          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
        >
          + Agregar destino
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => {
          const esPrimero = i === 0;
          const labelDestino = `Destino ${i + 1}`;
          return (
            <div
              key={`${groupId}-dest-${i}`}
              className="grid grid-cols-1 gap-2 rounded border border-black/10 bg-white/60 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-end"
            >
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 sm:grid sm:grid-cols-[auto_1fr] sm:items-end sm:gap-2">
                <span className={LABEL}>
                  {labelDestino}
                  {esPrimero && <span className="text-red-500"> *</span>}
                </span>
                <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end">
                  <PaisUbicacionSelect
                    value={row.pais}
                    onChange={(p: PaisCodigo) => setRow(i, { pais: p, etiqueta: '' })}
                    aria-label={`País de ${labelDestino.toLowerCase()}`}
                    className={`${inputClassName} w-full sm:w-40`}
                  />
                  <CiudadCombobox
                    pais={row.pais}
                    value={row.etiqueta}
                    onChange={(next) => setRow(i, { etiqueta: next })}
                    inputClassName={`${inputClassName} w-full`}
                    disableBrowserAutocomplete={disableBrowserAutocomplete}
                  />
                </div>
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  disabled={esPrimero}
                  onClick={() => removeRow(i)}
                  className="text-xs uppercase tracking-wider px-2 py-1 border border-black/15 text-vialto-steel hover:bg-red-50 disabled:opacity-40"
                  title={esPrimero ? 'El primer destino es obligatorio' : 'Quitar destino'}
                >
                  Quitar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
