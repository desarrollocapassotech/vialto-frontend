/** Valores guardados en BD (`Carga.unidadMedida`). */
export const UNIDADES_MEDIDA_CARGA_OPCIONES = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'tn', label: 'Toneladas (tn)' },
  { value: 'pallets', label: 'Pallets' },
  { value: 'unidades', label: 'Unidades' },
  { value: 'm3', label: 'Metros cúbicos (m³)' },
  { value: 'l', label: 'Litros (l)' },
  { value: 'cajas', label: 'Cajas' },
  { value: 'bultos', label: 'Bultos' },
] as const;

const codigos = new Set<string>(UNIDADES_MEDIDA_CARGA_OPCIONES.map((o) => o.value));

export function etiquetaUnidadMedidaCarga(codigo: string | null | undefined): string {
  if (!codigo?.trim()) return '—';
  const row = UNIDADES_MEDIDA_CARGA_OPCIONES.find((o) => o.value === codigo);
  return row?.label ?? codigo.trim();
}

export function unidadMedidaCargaEsCatalogo(codigo: string | null | undefined): boolean {
  if (!codigo?.trim()) return false;
  return codigos.has(codigo.trim());
}
