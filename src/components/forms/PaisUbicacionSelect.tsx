import { PAISES_SOPORTADOS, type PaisCodigo } from '@/lib/ciudades';

type SharedProps = {
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

type RequiredProps = SharedProps & {
  value: PaisCodigo;
  onChange: (pais: PaisCodigo) => void;
  placeholder?: never;
};

type OptionalProps = SharedProps & {
  value: PaisCodigo | '';
  onChange: (pais: PaisCodigo | '') => void;
  placeholder: string;
};

type Props = RequiredProps | OptionalProps;

const defaultClass =
  'h-9 w-full min-w-[9.5rem] border border-black/15 bg-white px-2 text-sm text-vialto-charcoal';

export function PaisUbicacionSelect({
  value,
  onChange,
  placeholder,
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
      {placeholder !== undefined && (
        <option value="">{placeholder}</option>
      )}
      {PAISES_SOPORTADOS.map((p) => (
        <option key={p.codigo} value={p.codigo}>
          {p.etiqueta}
        </option>
      ))}
    </select>
  );
}
