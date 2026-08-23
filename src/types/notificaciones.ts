export type NotificacionConfigEfectiva = {
  tipo: string;
  modulo: string;
  label: string;
  descripcion: string;
  activo: boolean;
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
