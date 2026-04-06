import { PAISES_SOPORTADOS, type PaisCodigo } from '@/lib/ciudades';

type Props = {
  value: PaisCodigo;
  onChange: (pais: PaisCodigo) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

const defaultClass =
  'h-9 w-full min-w-[9.5rem] border border-black/15 bg-white px-2 text-sm text-vialto-charcoal';

export function PaisUbicacionSelect({
  value,
  onChange,
  id,
  disabled,
  className,
  'aria-label': ariaLabel = 'País',
}: Props) {
  return (
    <select
      id={id}
      disabled={disabled}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as PaisCodigo)}
      className={className ?? defaultClass}
    >
      {PAISES_SOPORTADOS.map((p) => (
        <option key={p.codigo} value={p.codigo}>
          {p.etiqueta}
        </option>
      ))}
    </select>
  );
}
