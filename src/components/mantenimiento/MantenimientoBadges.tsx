import { ESTADO_ORDEN, ESTADO_VENCIMIENTO } from "@/lib/mantenimientoLabels";
import type { EstadoOrden, EstadoVencimiento } from "@/types/mantenimiento";

const BADGE_BASE =
  "inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.12em]";

export function EstadoVencimientoBadge({ estado }: { estado: EstadoVencimiento }) {
  const e = ESTADO_VENCIMIENTO[estado];
  return <span className={`${BADGE_BASE} ${e.badge}`}>{e.label}</span>;
}

export function EstadoOrdenBadge({ estado }: { estado: EstadoOrden }) {
  const e = ESTADO_ORDEN[estado] ?? ESTADO_ORDEN.cerrada;
  return <span className={`${BADGE_BASE} ${e.badge}`}>{e.label}</span>;
}
