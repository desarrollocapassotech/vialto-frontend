import type { ReactNode } from 'react';

export type ViajeOperacionModo = 'propio' | 'externo';

const legendClass =
  'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';

type Props = {
  modo: ViajeOperacionModo;
  onModoChange: (modo: ViajeOperacionModo) => void;
  externoContent: ReactNode;
  propioContent: ReactNode;
  /** id único por instancia para agrupar radios (evita colisiones en la misma página) */
  groupName?: string;
  className?: string;
};

export function ViajeOperacionTipoFieldset({
  modo,
  onModoChange,
  externoContent,
  propioContent,
  groupName = 'viaje-operacion-tipo',
  className,
}: Props) {
  return (
    <fieldset
      className={
        className ?? 'min-w-0 space-y-3 border-0 p-0 md:col-span-2 lg:col-span-3 [&:disabled]:opacity-60'
      }
    >
      <legend className={`${legendClass} mb-2`}>¿Quién realiza el transporte?</legend>
      <div className="flex flex-wrap gap-4 sm:gap-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-vialto-charcoal">
          <input
            type="radio"
            name={groupName}
            className="h-4 w-4 accent-vialto-charcoal"
            checked={modo === 'externo'}
            onChange={() => onModoChange('externo')}
          />
          <span>Transporte externo (tercerizado)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-vialto-charcoal">
          <input
            type="radio"
            name={groupName}
            className="h-4 w-4 accent-vialto-charcoal"
            checked={modo === 'propio'}
            onChange={() => onModoChange('propio')}
          />
          <span>Flota propia (chofer y vehículo)</span>
        </label>
      </div>
      <div className="pt-1">{modo === 'externo' ? externoContent : propioContent}</div>
    </fieldset>
  );
}
