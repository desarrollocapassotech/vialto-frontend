import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { listadoTablaAccionClass } from '@/lib/listadoTabla';

type Props = ComponentPropsWithoutRef<'button'> & {
  open?: boolean;
};

export const AccionesMenuTrigger = forwardRef<HTMLButtonElement, Props>(
  function AccionesMenuTrigger({ open = false, className = '', ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        title="Acciones"
        aria-label="Abrir menú de acciones"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          listadoTablaAccionClass,
          'gap-1.5 font-[family-name:var(--font-ui)] text-vialto-steel hover:text-vialto-charcoal',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        <span>Acciones</span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={[
            'h-3 w-3 shrink-0 transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  },
);
