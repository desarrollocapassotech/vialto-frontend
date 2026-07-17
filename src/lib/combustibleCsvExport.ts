import type { CargaCombustible } from '@/types/api';
import { cargaCombustibleColumnas, periodoArchivoCargas } from './combustibleExcelExport';

const SEPARADOR = ';'; // Estándar argentino para Excel (la coma queda para los decimales).

/**
 * Serializa un valor de celda para CSV.
 * - Números: coma decimal (es-AR), sin separador de miles, para que Excel los
 *   interprete como número al abrir el CSV con separador `;`.
 * - Texto: se entrecomilla y escapa solo si contiene `;`, comillas o saltos de línea.
 */
function formatCsvValue(value: string | number): string {
  if (typeof value === 'number') {
    return String(value).replace('.', ',');
  }
  const s = value ?? '';
  if (/[";\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function descargarArchivo(contenido: BlobPart, filename: string, mime: string): void {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Genera y descarga el CSV de cargas de combustible en el navegador.
 * Usa exactamente las mismas columnas y datos que el Excel (fuente compartida).
 * - Separador de campos: `;`
 * - BOM UTF-8 para que Excel detecte acentos y ñ correctamente.
 * - Fin de línea CRLF por compatibilidad con Excel.
 * El nombre incluye el período: `cargas-combustible-<periodo>.csv`.
 */
export function exportarCargasCombustibleCsv(
  cargas: CargaCombustible[],
  opts?: { from?: string; to?: string },
): void {
  const cols = cargaCombustibleColumnas();

  const filas = [
    cols.map((c) => formatCsvValue(c.label)).join(SEPARADOR),
    ...cargas.map((carga) =>
      cols.map((c) => formatCsvValue(c.getValue(carga))).join(SEPARADOR),
    ),
  ];

  const contenido = '\uFEFF' + filas.join('\r\n');
  const periodo = periodoArchivoCargas(cargas, opts);
  descargarArchivo(contenido, `cargas-combustible-${periodo}.csv`, 'text/csv;charset=utf-8;');
}
