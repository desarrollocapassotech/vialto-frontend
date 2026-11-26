import type { NotificacionFeedItem } from "@/types/notificaciones";

/**
 * A qué pantalla lleva el click de una notificación del feed. Primero la `url` que guarda el backend
 * con cada aviso (la misma del botón "Ver" del email); los avisos viejos, sin `url`, se resuelven por
 * tipo. Devuelve null si no hay destino.
 */
export function resolveNotificacionRoute(item: NotificacionFeedItem): string | null {
  if (item.url) return item.url;
  if (!item.entidadId) return null;
  switch (item.tipo) {
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
