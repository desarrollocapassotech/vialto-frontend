/** Aviso legal visible antes de exportar MIC/CRT. */
export const MIC_CRT_LEGAL_DISCLAIMER =
  'El documento generado es un borrador de apoyo operativo sin validez legal. La emisión oficial debe realizarse a través del sistema de ARCA.';

/** Etiqueta con número de campo del formulario físico MIC/DTA. */
export function labelCampo(nombre: string, campo: number | string): string {
  return `${nombre} (Campo ${campo})`;
}

/** Campo de la hoja CRT (2.ª página o bloque CRT). */
export function labelCampoCrt(nombre: string, campo: number): string {
  return `${nombre} (Campo ${campo} CRT)`;
}
