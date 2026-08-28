export const AVAILABLE_MODULES = [
  'viajes',
  'facturacion',
  'integracion-arca',
  'cuenta-corriente',
  'stock',
  'combustible',
  'mantenimiento',
] as const;

export type AvailableModuleCode = (typeof AVAILABLE_MODULES)[number];
