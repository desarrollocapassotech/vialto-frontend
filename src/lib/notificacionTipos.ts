import {
  Bell,
  CalendarClock,
  CalendarX,
  Fuel,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NotificacionFeedGrupo, NotificacionFeedItem } from "@/types/notificaciones";

type TipoUI = {
  /** Nombre corto del grupo en la página de Notificaciones. */
  nombre: string;
  icono: LucideIcon;
  /** Saca del título lo que el nombre del grupo ya dice (ej. "Carga sospechosa — "). */
  limpiarTitulo?: (titulo: string) => string;
};

/** Presentación de cada tipo del catálogo (backend: notificaciones-catalog.ts). */
const TIPOS: Record<string, TipoUI> = {
  "combustible.cargaSospechosa": {
    nombre: "Cargas sospechosas",
    icono: Fuel,
    limpiarTitulo: (t) => t.replace(/^Carga sospechosa — /, ""),
  },
  "combustible.errorChofer": { nombre: "Cargas de choferes sin registrar", icono: Smartphone },
  "facturacion.facturaVencida": { nombre: "Facturas vencidas", icono: CalendarX },
  "facturacion.facturaPorVencer": { nombre: "Facturas por vencer", icono: CalendarClock },
  "cuenta-corriente.vencimiento": { nombre: "Vencimientos de cuenta corriente", icono: Wallet },
};

export function tipoNotificacionUI(tipo: string, labelBackend: string): Required<TipoUI> {
  const t = TIPOS[tipo];
  return {
    nombre: t?.nombre ?? labelBackend,
    icono: t?.icono ?? Bell,
    limpiarTitulo: t?.limpiarTitulo ?? ((s) => s),
  };
}

/** Con hasta esta cantidad de avisos en total (todos los tipos), se listan sueltos, sin agrupar. */
export const MAX_AVISOS_SIN_AGRUPAR = 5;

/**
 * Si entre todos los grupos hay `MAX_AVISOS_SIN_AGRUPAR` avisos o menos, devuelve la lista
 * plana (más recientes primero); si hay más, `null` = mostrar agrupado. Requiere que cada
 * grupo traiga al menos `MAX_AVISOS_SIN_AGRUPAR` ítems (`porTipo`), así con pocos avisos
 * ya están todos sin otra consulta.
 */
export function avisosSinAgrupar(grupos: NotificacionFeedGrupo[]): NotificacionFeedItem[] | null {
  const total = grupos.reduce((s, g) => s + g.total, 0);
  if (total > MAX_AVISOS_SIN_AGRUPAR) return null;
  return grupos
    .flatMap((g) => g.items)
    .sort((a, b) => new Date(b.enviadoAt).getTime() - new Date(a.enviadoAt).getTime());
}

/**
 * Evento de `window` que dispara la página de Notificaciones al marcar avisos como vistos,
 * para que la campana actualice su contador al instante (sin esperar a su poll).
 */
export const EVENTO_NOTIFICACIONES_VISTAS = "vialto:notificaciones-vistas";

/** Detalle más corto: el "Motivo:" de las sospechosas es redundante con el texto que sigue. */
export function detalleCorto(detalle: string): string {
  return detalle.replace(/Motivo: /, "");
}

/** "recién", "hace 5 min", "hace 3 h", "hace 2 d"; más de una semana: "25 sep". */
export function fechaRelativa(iso: string): string {
  const fecha = new Date(iso);
  const min = Math.floor((Date.now() - fecha.getTime()) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  if (dias <= 7) return `hace ${dias} d`;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(fecha);
}
