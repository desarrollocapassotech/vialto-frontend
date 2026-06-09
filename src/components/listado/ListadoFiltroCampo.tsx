import type { ReactNode } from 'react';

type Props = {
  label: string;
  active?: boolean;
  children: ReactNode;
};

export function ListadoFiltroCampo({ label, active = false, children }: Props) {
  return (
    <div className="flex flex-col gap-2 border-b border-black/5 pb-4 last:border-0 last:pb-0">
      <span
        className={[
          'font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em]',
          active ? 'text-vialto-fire' : 'text-vialto-steel',
        ].join(' ')}
      >
        {label}
      </span>
      <div className="normal-case tracking-normal">{children}</div>
    </div>
  );
}
