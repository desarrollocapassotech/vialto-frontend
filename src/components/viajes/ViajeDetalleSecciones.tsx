import type { ReactNode } from "react";

/**
 * Secciones del detalle de un viaje (Estado / Facturación / Liquidación): recuadro con
 * título chico y filas label → valor, mismo lenguaje visual que `DetalleMontosCard`.
 */

export function SeccionDetalleViaje({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  /** Acción chica a la derecha del título (ej. "Ver factura"). */
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
        <p className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.2em] text-vialto-steel">
          {titulo}
        </p>
        {accion}
      </div>
      <div className="rounded border border-black/10 bg-white px-4 py-1">{children}</div>
    </div>
  );
}

/** Fila label → valor de una sección; `sub` es una línea secundaria debajo del valor. */
export function FilaDetalleViaje({
  label,
  value,
  sub,
  subClassName = "text-vialto-steel",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  subClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/5 py-1.5 last:border-0">
      <span className="shrink-0 text-xs text-vialto-steel">{label}</span>
      <span className="min-w-0 text-right">
        <span className="block text-sm tabular-nums text-vialto-charcoal">{value ?? "—"}</span>
        {sub && <span className={`block text-[11px] ${subClassName}`}>{sub}</span>}
      </span>
    </div>
  );
}

/** Botón chico de acción en el título de una sección. */
export function AccionSeccionViaje({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] uppercase tracking-[0.12em] text-vialto-fire hover:underline"
    >
      {children}
    </button>
  );
}

/** Badge chico de estado dentro de una fila. */
export function BadgeEstadoViaje({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}
