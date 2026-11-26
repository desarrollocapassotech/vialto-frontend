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
  entidadId: string;
  label: string;
  titulo: string;
  detalle: string;
  /** Ruta de la app que abre el registro del aviso (la arma el backend). Null en avisos viejos. */
  url?: string | null;
  enviadoAt: string;
  leido: boolean;
};

export type NotificacionFeed = {
  noLeidas: number;
  items: NotificacionFeedItem[];
};

/** GET /notificaciones/feed/agrupado — un grupo por tipo de aviso. */
export type NotificacionFeedGrupo = {
  tipo: string;
  label: string;
  total: number;
  noLeidas: number;
  items: NotificacionFeedItem[];
};
