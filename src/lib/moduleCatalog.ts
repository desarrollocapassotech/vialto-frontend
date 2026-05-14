export const AVAILABLE_MODULES = [
  'viajes',
  'facturacion',
  'liquidaciones-arca',
  'cuenta-corriente',
  'stock',
  'combustible',
  'mantenimiento',
  'remitos',
  'turnos',
  'reportes',
] as const;

export type AvailableModuleCode = (typeof AVAILABLE_MODULES)[number];
