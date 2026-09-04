import type { NotificacionFeedItem } from "@/types/notificaciones";

/** A qué pantalla lleva el click de una notificación del feed, según su tipo. Devuelve null si el tipo no tiene destino definido. */
export function resolveNotificacionRoute(item: NotificacionFeedItem): string | null {
  if (!item.entidadId) return null;
  switch (item.tipo) {
    case "facturacion.facturaPorVencer":
      return `/facturacion?factura=${encodeURIComponent(item.entidadId)}`;
    case "combustible.cargaSospechosa":
      return `/combustible?carga=${encodeURIComponent(item.entidadId)}`;
    default:
      return null;
  }
}
