import { CrudSelect } from '@/components/crud/CrudFields';
import type { Transportista } from '@/types/api';

export type AsignacionModo = 'propio' | 'externo';

const legendClass =
  'font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel';

type Props = {
  modo: AsignacionModo;
  onModoChange: (m: AsignacionModo) => void;
  /** id del transportista cuando modo es externo; vacío si aún no eligió */
  transportistaId: string;
  onTransportistaIdChange: (id: string) => void;
  transportistas: Transportista[];
  loadingTransportistas?: boolean;
  disabled?: boolean;
};

export function TransportistaAsignacionFields({
  modo,
  onModoChange,
  transportistaId,
  onTransportistaIdChange,
  transportistas,
  loadingTransportistas,
  disabled,
}: Props) {
  return (
    <fieldset className="grid gap-3 border-0 p-0">
      <legend className={legendClass}>Pertenencia</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="asignacion-transportista"
            className="accent-vialto-charcoal"
            checked={modo === 'propio'}
            disabled={disabled}
            onChange={() => onModoChange('propio')}
          />
          Flota propia
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="asignacion-transportista"
            className="accent-vialto-charcoal"
            checked={modo === 'externo'}
            disabled={disabled}
            onChange={() => onModoChange('externo')}
          />
          Transportista externo
        </label>
      </div>
      {modo === 'externo' && (
        <label className="grid gap-1.5">
          <span className={legendClass}>Transportista</span>
          <CrudSelect
            value={transportistaId}
            disabled={disabled || loadingTransportistas}
            onChange={(e) => onTransportistaIdChange(e.target.value)}
          >
            <option value="">
              {loadingTransportistas ? 'Cargando…' : 'Seleccioná un transportista…'}
            </option>
            {transportistas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </CrudSelect>
          {!loadingTransportistas && transportistas.length === 0 && (
            <span className="text-xs text-vialto-steel">
              No hay transportistas cargados. Creá uno en Transportistas primero.
            </span>
          )}
        </label>
      )}
    </fieldset>
  );
}
