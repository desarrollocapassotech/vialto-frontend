import type { LucideIcon } from "lucide-react";
import { FiltroRapidoChip, FiltrosRapidosGrupo } from "@/components/listado/FiltroRapidoChip";

export type FiltroRapidoOpcion<T extends string> = {
  id: T;
  label: string;
  /** Ícono del filtro (lucide). */
  icon?: LucideIcon;
  /** Cantidad de registros que trae el filtro (se muestra al lado del label). */
  count?: number;
};

type Props<T extends string> = {
  opciones: FiltroRapidoOpcion<T>[];
  /** Opción activa; "" = ninguna. Las opciones son excluyentes entre sí. */
  value: T | "";
  onChange: (value: T | "") => void;
  ariaLabel: string;
};

/**
 * Filtros rápidos al lado del título (Facturas, Liquidaciones, Cuenta corriente,
 * Vencimientos…): cápsula siempre visible con el embudo tenue adentro y un chip con
 * ícono y contador por opción, mismo estilo que el filtro de período del dashboard.
 * Tocar el chip activo lo desactiva.
 */
export function FiltrosRapidos<T extends string>({
  opciones,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <FiltrosRapidosGrupo ariaLabel={ariaLabel}>
      {opciones.map((o) => {
        const active = value === o.id;
        return (
          <FiltroRapidoChip
            key={o.id}
            label={o.label}
            icon={o.icon}
            active={active}
            count={o.count}
            onClick={() => onChange(active ? "" : o.id)}
          />
        );
      })}
    </FiltrosRapidosGrupo>
  );
}
