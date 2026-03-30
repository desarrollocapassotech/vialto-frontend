import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const variants: Record<Variant, string> = {
  primary:
    'bg-vialto-fire text-white hover:bg-vialto-bright border border-transparent',
  secondary:
    'bg-transparent text-vialto-charcoal border border-vialto-steel/40 hover:border-vialto-steel',
  ghost:
    'bg-transparent text-vialto-fire border border-vialto-fire hover:bg-vialto-fire/10',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.15em] font-semibold px-8 py-3.5 rounded-sm transition-colors disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        className,
      ].join(' ')}
      {...props}
    />
  );
}
