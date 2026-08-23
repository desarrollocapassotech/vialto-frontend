export type NotificacionConfigEfectiva = {
  tipo: string;
  modulo: string;
  label: string;
  descripcion: string;
  activo: boolean;
  /** userIds de Clerk elegidos a mano para este tipo. Vacío = default (todos los administradores). */
  destinatarios: string[];
};

export type NotificacionFeedItem = {
  id: string;
  tipo: string;
  label: string;
  titulo: string;
  detalle: string;
  enviadoAt: string;
  leido: boolean;
};

export type NotificacionFeed = {
  noLeidas: number;
  items: NotificacionFeedItem[];
};
