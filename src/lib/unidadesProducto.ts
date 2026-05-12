/** Unidades de medida para el catálogo de Productos (módulo Stock). */
export const UNIDADES_PRODUCTO_OPCIONES = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'tn', label: 'Toneladas (tn)' },
  { value: 'unidades', label: 'Unidades' },
  { value: 'rollos', label: 'Rollos' },
  { value: 'pallets', label: 'Pallets' },
  { value: 'bultos', label: 'Bultos' },
  { value: 'cajas', label: 'Cajas' },
  { value: 'm3', label: 'Metros cúbicos (m³)' },
  { value: 'litros', label: 'Litros (l)' },
] as const;

const codigos = new Set<string>(UNIDADES_PRODUCTO_OPCIONES.map((o) => o.value));

export function etiquetaUnidadProducto(codigo: string | null | undefined): string {
  if (!codigo?.trim()) return '—';
  const row = UNIDADES_PRODUCTO_OPCIONES.find((o) => o.value === codigo);
  return row?.label ?? codigo.trim();
}

export function unidadProductoEsCatalogo(codigo: string | null | undefined): boolean {
  if (!codigo?.trim()) return false;
  return codigos.has(codigo.trim());
}
