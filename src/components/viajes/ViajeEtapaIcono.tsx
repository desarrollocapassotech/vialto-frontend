import type { LucideIcon } from 'lucide-react';
import { Ban, CalendarClock, CircleHelp, Flag, Truck } from 'lucide-react';
import { EstadoIcono } from '@/components/viajes/EstadoIcono';
import {
  etapaViajeBadgeClass,
  etapaViajeBadgeClassDefault,
  etapaViajeLabel,
  tooltipEtapaViaje,
} from '@/lib/viajesIndicadores';

const ICONO_ETAPA: Record<string, LucideIcon> = {
  pendiente: CalendarClock,
  en_curso: Truck,
  finalizado: Flag,
  cancelado: Ban,
};

/**
 * Etapa del viaje como ícono compacto (columna "Etapa" de la grilla). No es clickeable:
 * la etapa se actualiza sola por fechas y los casos manuales (cancelar, viajes sin
 * fechas) se editan desde el modal del viaje.
 */
export function ViajeEtapaIcono({ etapa }: { etapa: string }) {
  const label = etapaViajeLabel[etapa] ?? 'Sin clasificar';
  const ayuda = tooltipEtapaViaje(etapa);
  return (
    <EstadoIcono
      icon={ICONO_ETAPA[etapa] ?? CircleHelp}
      colorClass={etapaViajeBadgeClass[etapa] ?? etapaViajeBadgeClassDefault}
      title={ayuda ? `${label}\n${ayuda}` : label}
    />
  );
}
