import { useState } from 'react';
import { TipoCargaSearchableSelect } from '@/components/viajes/TipoCargaSearchableSelect';
import { TipoCargaNuevoModal } from '@/components/viajes/TipoCargaNuevoModal';
import type { OpcionCarga } from '@/lib/cargasOpciones';
import type { Carga } from '@/types/api';

export type ViajeCargasListaProps = {
  groupId: string;
  /** IDs en orden (puede incluir filas vacías `''` mientras se elige). */
  value: string[];
  onChange: (ids: string[]) => void;
  opciones: OpcionCarga[];
  triggerClassName: string;
  disabled?: boolean;
  puedeCrearCarga?: boolean;
  getToken: () => Promise<string | null>;
  createPostUrl?: string;
  onCargaCreada?: (carga: Carga) => void;
};

export function ViajeCargasLista({
  groupId,
  value,
  onChange,
  opciones,
  triggerClassName,
  disabled,
  puedeCrearCarga,
  getToken,
  createPostUrl = '/api/cargas',
  onCargaCreada,
}: ViajeCargasListaProps) {
  const [altaOpen, setAltaOpen] = useState(false);
  const [altaNombre, setAltaNombre] = useState('');
  const [altaRowIndex, setAltaRowIndex] = useState(0);

  function patchRow(i: number, id: string) {
    const next = [...value];
    next[i] = id;
    onChange(next);
  }

  function removeRow(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  function addRow() {
    onChange([...value, '']);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {value.length === 0 ? (
          <p className="text-xs text-vialto-steel">Sin cargas indicadas (opcional).</p>
        ) : null}
        {value.map((id, i) => (
          <div
            key={`${groupId}-carga-${i}`}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="min-w-0 flex-1 basis-[12rem]">
              <TipoCargaSearchableSelect
                id={`${groupId}-carga-${i}`}
                value={id}
                onChange={(v) => patchRow(i, v)}
                opciones={opciones}
                triggerClassName={triggerClassName}
                disabled={disabled}
                onSolicitarCrearNueva={
                  puedeCrearCarga
                    ? (sugerencia) => {
                        setAltaNombre(sugerencia);
                        setAltaRowIndex(i);
                        setAltaOpen(true);
                      }
                    : undefined
                }
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeRow(i)}
              className="h-9 shrink-0 px-2 text-xs uppercase tracking-wider text-vialto-steel border border-black/15 bg-white hover:bg-vialto-mist disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={addRow}
          className="h-9 w-fit px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
        >
          + Agregar carga
        </button>
      </div>
      <TipoCargaNuevoModal
        open={altaOpen}
        onClose={() => setAltaOpen(false)}
        nombreInicial={altaNombre}
        getToken={getToken}
        createPostUrl={createPostUrl}
        overlayClassName="z-[400]"
        onCreated={(carga) => {
          onCargaCreada?.(carga);
          const next = [...value];
          next[altaRowIndex] = carga.id;
          onChange(next);
          setAltaOpen(false);
        }}
      />
    </>
  );
}
