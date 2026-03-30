/** Etiquetas legibles para valores que vienen del sistema (sin mostrar códigos crudos). */

const vehiculoTipo: Record<string, string> = {
  tractor: 'Tractor',
  semirremolque: 'Semirremolque',
  camion: 'Camión',
  utilitario: 'Utilitario',
  otro: 'Otro',
};

export function labelVehiculoTipo(codigo: string): string {
  const known = vehiculoTipo[codigo];
  if (known) return known;
  return codigo
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
