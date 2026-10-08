import type { NotificacionFeedItem } from "@/types/notificaciones";

/** A qué pantalla lleva el click de una notificación del feed, según su tipo. Devuelve null si el tipo no tiene destino definido. */
export function resolveNotificacionRoute(item: NotificacionFeedItem): string | null {
  if (!item.entidadId) return null;
  switch (item.tipo) {
    case "facturacion.facturaPorVencer":
    case "facturacion.facturaVencida":
      return `/facturacion?factura=${encodeURIComponent(item.entidadId)}`;
    case "combustible.cargaSospechosa":
      return `/combustible?carga=${encodeURIComponent(item.entidadId)}`;
    case "combustible.errorChofer":
      // entidadId es el localId de la carga en el celular, no un id navegable: va a la lista
      // de Alertas, donde está el detalle con la explicación.
      return "/?combustibleTab=alertas";
    default:
      return null;
  }
}
