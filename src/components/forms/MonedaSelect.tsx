import type { ViajeMonedaCodigo } from '@/lib/currencyMask';

type Props = {
  value: ViajeMonedaCodigo;
  onChange: (value: ViajeMonedaCodigo) => void;
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
};

const baseClass =
  'h-9 shrink-0 rounded border border-black/15 bg-white px-2 text-xs font-medium tabular-nums text-vialto-charcoal';

export function MonedaSelect({
  value,
  onChange,
  id,
  'aria-label': ariaLabel,
  disabled,
  className,
}: Props) {
  return (
    <select
      id={id}
      aria-label={ariaLabel ?? 'Moneda'}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value as ViajeMonedaCodigo)}
      className={className ?? baseClass}
    >
      <option value="ARS">ARS</option>
      <option value="USD">USD</option>
    </select>
  );
}
