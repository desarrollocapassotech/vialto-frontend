import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { PaisSearchSelect } from '@/components/forms/PaisSearchSelect';
import type { PaisCodigo } from '@/lib/ciudades';
import type { Pais } from '@/types/api';
import { emptyDestinoRow, type ViajeDestinoRowDraft } from '@/lib/viajesDestinos';

const LABEL =
  'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';
/** Mismo estilo que `fieldLabelClass` de ViajeClientesFieldset.tsx (label "Origen"). */
const sectionLabelClass =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';
const autocompletarBtnClass =
  'text-[11px] normal-case tracking-normal text-vialto-steel underline decoration-dotted underline-offset-2 hover:text-vialto-fire';

type Props = {
  rows: ViajeDestinoRowDraft[];
  onChange: (rows: ViajeDestinoRowDraft[]) => void;
  inputClassName: string;
  /** Para ids accesibles únicos entre formularios. */
  groupId: string;
  disableBrowserAutocomplete?: boolean;
  paises: Pais[];
  paisesLoading?: boolean;
  /** Dispara la creación rápida de país para la fila `index`. */
  onNuevoPais: (index: number) => void;
  /** Si se pasa, el país queda fijo a este país: no se muestra el selector, solo el buscador de ciudad. */
  paisFijo?: Pais | null;
  /** Sugerencia "para la vuelta" (origen del primer cliente) para el botón de autocompletar del Destino 1. */
  sugerenciaPrimerDestino?: { pais: PaisCodigo; etiqueta: string } | null;
};

export function ViajeDestinosLista({
  rows,
  onChange,
  inputClassName,
  groupId,
  disableBrowserAutocomplete,
  paises,
  paisesLoading = false,
  onNuevoPais,
  paisFijo = null,
  sugerenciaPrimerDestino = null,
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
    <div className="flex flex-col gap-3">
      <span className={sectionLabelClass}>{rows.length > 1 ? 'Destinos' : 'Destino'}</span>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => {
          const esPrimero = i === 0;
          const labelDestino = `Destino ${i + 1}`;
          return (
            <div
              key={`${groupId}-dest-${i}`}
              className="grid grid-cols-1 gap-2 rounded border border-black/10 bg-white/60 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-end"
            >
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                {esPrimero && sugerenciaPrimerDestino && !row.etiqueta.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      setRow(i, { pais: sugerenciaPrimerDestino.pais, etiqueta: sugerenciaPrimerDestino.etiqueta })
                    }
                    className={`self-start ${autocompletarBtnClass}`}
                    title={`Autocompletar con ${sugerenciaPrimerDestino.etiqueta}`}
                  >
                    ↺ Autocompletar con {sugerenciaPrimerDestino.etiqueta}
                  </button>
                )}
                {(() => {
                  const camposDestino = (
                    <div className={`grid gap-2 sm:items-end ${paisFijo ? '' : 'sm:grid-cols-[auto_1fr]'}`}>
                      {!paisFijo && (
                        <PaisSearchSelect
                          paises={paises}
                          loading={paisesLoading}
                          value={row.pais}
                          onChange={(p) => setRow(i, { pais: p as PaisCodigo, etiqueta: '' })}
                          aria-label={`País de ${labelDestino.toLowerCase()}`}
                          className="w-full sm:w-40"
                          inputClassName={inputClassName}
                          onNuevo={() => onNuevoPais(i)}
                        />
                      )}
                      <CiudadCombobox
                        pais={paisFijo ? (paisFijo.codigo || paisFijo.id) : row.pais}
                        paisNombre={
                          paisFijo
                            ? paisFijo.nombre
                            : paises.find((p) => (p.codigo || p.id) === row.pais)?.nombre
                        }
                        value={row.etiqueta}
                        onChange={(next) => setRow(i, { etiqueta: next })}
                        inputClassName={`${inputClassName} w-full`}
                        disableBrowserAutocomplete={disableBrowserAutocomplete}
                      />
                    </div>
                  );
                  return esPrimero ? (
                    camposDestino
                  ) : (
                    <div className="flex min-w-0 flex-col gap-1 sm:grid sm:grid-cols-[auto_1fr] sm:items-end sm:gap-2">
                      <span className={LABEL}>{labelDestino}</span>
                      {camposDestino}
                    </div>
                  );
                })()}
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
      <button
        type="button"
        disabled={!rows[rows.length - 1]?.etiqueta.trim()}
        onClick={addRow}
        className="self-start text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
      >
        + Agregar destino
      </button>
    </div>
  );
}
