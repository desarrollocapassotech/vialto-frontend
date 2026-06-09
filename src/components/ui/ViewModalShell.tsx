import type { ReactNode } from 'react';
import { modalOverlayClass } from '@/lib/modalLayers';

type ViewModalShellProps = {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  scrollBody?: boolean;
  onOverlayClick?: () => void;
};

export function ViewModalShell({
  title,
  onClose,
  children,
  footer,
  maxWidthClass = 'sm:max-w-xl',
  scrollBody = false,
  onOverlayClick,
}: ViewModalShellProps) {
  return (
    <div
      className={modalOverlayClass}
      role="presentation"
      onClick={onOverlayClick ?? onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={[
          'flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-h-[90vh] sm:rounded',
          maxWidthClass,
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-4 sm:px-6">
          <h2 className="min-w-0 truncate font-[family-name:var(--font-display)] text-lg tracking-wide sm:text-xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div
          className={[
            'px-4 py-5 sm:px-6',
            scrollBody ? 'min-h-0 flex-1 overflow-y-auto' : '',
          ].join(' ')}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 px-4 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const viewModalGridClass = 'grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2';

export const viewModalBtnGhost =
  'inline-flex min-h-11 items-center px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist';

export const viewModalBtnPrimary =
  'inline-flex min-h-11 items-center px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite';
