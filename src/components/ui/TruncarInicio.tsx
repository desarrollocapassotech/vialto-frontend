import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Ancho máximo y estilos extra (ej. `max-w-[5rem]`). */
  className?: string;
  title?: string;
};

/**
 * Texto truncado por el PRINCIPIO: muestra los últimos caracteres con "…" a la izquierda
 * (ej. "…01406"). Para IDs, donde lo que distingue a uno de otro suele ser el final.
 * El contenedor va en `rtl` para que el recorte y la elipsis queden a la izquierda, y el
 * texto en un `<bdi dir="ltr">` para que su orden no se altere (guiones, "#", espacios).
 */
export function TruncarInicio({ children, className = '', title }: Props) {
  return (
    <span dir="rtl" className={`block truncate text-left ${className}`} title={title}>
      <bdi dir="ltr">{children}</bdi>
    </span>
  );
}
