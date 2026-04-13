/** Valores alineados con el maestro de vehículos (`Vehiculo.tipo`). */
export const VEHICULO_TIPO_VALORES = [
  'tractor',
  'semirremolque',
  'camion',
  'utilitario',
  'otro',
] as const;

export type VehiculoTipoValor = (typeof VEHICULO_TIPO_VALORES)[number];

export const VEHICULO_TIPO_LABEL: Record<string, string> = {
  tractor: 'Tractor',
  semirremolque: 'Semirremolque',
  camion: 'Camión',
  utilitario: 'Utilitario',
  otro: 'Otro',
};

export function labelTipoVehiculo(tipo: string): string {
  const k = tipo.trim().toLowerCase();
  return VEHICULO_TIPO_LABEL[k] ?? tipo;
}

export function vehiculosPorTipo<T extends { id: string; tipo: string }>(
  vehiculos: T[],
  tipo: string,
): T[] {
  const t = tipo.trim().toLowerCase();
  return vehiculos.filter((v) => (v.tipo ?? '').trim().toLowerCase() === t);
}
