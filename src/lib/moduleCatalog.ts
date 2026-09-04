export const AVAILABLE_MODULES = [
  'viajes',
  'facturacion',
  'emision-facturas-arca',
  'emision-liquido-producto-arca',
  'cuenta-corriente',
  'stock',
  'combustible',
  'mantenimiento',
] as const;

export type AvailableModuleCode = (typeof AVAILABLE_MODULES)[number];
