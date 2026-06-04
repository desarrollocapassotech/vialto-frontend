/** Etiquetas para mensajes de toast en operaciones ABM. */
export const EL = {
  cliente: 'El cliente',
  transportista: 'El transportista',
  chofer: 'El chofer',
  vehiculo: 'El vehículo',
  viaje: 'El viaje',
  factura: 'La factura',
  producto: 'El producto',
  presentacion: 'La presentación',
  usuario: 'El usuario',
  empresa: 'La empresa',
  gasto: 'El gasto',
  pago: 'El pago',
} as const;

export type ElAbm = (typeof EL)[keyof typeof EL];

export const abmToast = {
  created: (el: ElAbm) => `${el} se creó correctamente.`,
  updated: (el: ElAbm) => `${el} se actualizó correctamente.`,
  saved: (el: ElAbm) => `${el} se guardó correctamente.`,
  deleted: (el: ElAbm) => `${el} se eliminó correctamente.`,
  deactivated: (el: ElAbm) => `${el} fue desactivado.`,
  activated: (el: ElAbm) => `${el} fue activado.`,
  invited: () => 'El usuario fue invitado correctamente.',
};
