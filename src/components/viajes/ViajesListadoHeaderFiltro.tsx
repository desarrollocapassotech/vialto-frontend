import type { ReactNode } from 'react';

type Props = {
  /** Título visible de la columna (se muestra en mayúsculas con el estilo del listado). */
  title: string;
  children: ReactNode;
};

/**
 * Celda de encabezado con título y control (dropdown con buscador).
 */
export function ViajesListadoHeaderFiltro({ title, children }: Props) {
  return (
    <div className="flex min-w-[9rem] flex-col gap-2">
      <span className="text-[11px] tracking-[0.2em] text-vialto-fire uppercase">{title}</span>
      <div
        className="normal-case text-sm tracking-normal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
