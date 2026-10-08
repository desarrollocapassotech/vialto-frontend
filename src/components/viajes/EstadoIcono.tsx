import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  Clock,
  Pencil,
  X,
} from 'lucide-react';

import type { EstadoGlifo } from '@/lib/viajesIndicadores';

/**
 * Mini-símbolo de la esquina del ícono de estado. El color nunca va solo: el símbolo
 * distingue el estado aunque no se perciba el color.
 */
const GLIFOS: Record<Exclude<EstadoGlifo, null>, LucideIcon> = {
  borrador: Pencil,
  esperando: Clock,
  ok: Check,
  cobrado: CircleDollarSign,
  error: AlertTriangle,
  anulado: X,
  parcial: Check,
};

type Props = {
  icon: LucideIcon;
  glifo?: EstadoGlifo;
  /** Clases de color (borde/fondo/texto) — las mismas de los badges de estado. */
  colorClass: string;
  /** Texto completo del estado; se muestra como tooltip. */
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Tachado visual (comprobante anulado). */
  tachado?: boolean;
};

/**
 * Ícono de estado compacto para una celda de una sola línea: ícono principal con el
 * color del estado y un mini-símbolo en la esquina. Clickeable si se pasa `onClick`.
 */
export function EstadoIcono({ icon: Icon, glifo = null, colorClass, title, onClick, disabled, tachado }: Props) {
  const Glifo = glifo ? GLIFOS[glifo] : null;
  const contenido = (
    <>
      <Icon className={`h-4 w-4 ${tachado ? 'opacity-60' : ''}`} strokeWidth={1.75} aria-hidden />
      {tachado && (
        <span aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 h-px -rotate-45 bg-current" />
      )}
      {Glifo && (
        <span
          aria-hidden
          className="absolute -right-1 -bottom-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current bg-white"
        >
          <Glifo className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      )}
    </>
  );
  const clase = `relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border ${colorClass}`;

  if (!onClick) {
    return (
      <span className={clase} title={title} aria-label={title} role="img">
        {contenido}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`${clase} cursor-pointer hover:brightness-95 disabled:cursor-wait disabled:opacity-60`}
    >
      {contenido}
    </button>
  );
}
