import type { Chofer } from '@/types/api';

export type ChoferFormState = {
  nombre: string;
  dni: string;
  cuit: string;
  telefono: string;
};

export function choferFormStateFromApi(row: Chofer): ChoferFormState {
  return {
    nombre: row.nombre ?? '',
    dni: row.dni ?? '',
    cuit: row.cuit ?? '',
    telefono: row.telefono ?? '',
  };
}

/** Solo dígitos; el backend exige 7 u 8 para DNI argentino. */
export function dniSoloDigitos(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function validarDniForm(dni: string): string | null {
  const d = dniSoloDigitos(dni);
  if (!d) return null;
  if (!/^\d{7,8}$/.test(d)) {
    return 'El DNI debe tener 7 u 8 dígitos (solo números).';
  }
  return null;
}

/**
 * Cuerpo POST/PATCH alineado con CreateChoferDto / UpdateChoferDto.
 * `cuit` y demás opcionales van siempre en el JSON (null si vacíos).
 */
export function choferWritePayloadFromForm(form: ChoferFormState): Record<string, unknown> {
  const dni = dniSoloDigitos(form.dni);
  const cuit = form.cuit.trim();
  return {
    nombre: form.nombre.trim(),
    dni: dni || null,
    cuit: cuit || null,
    telefono: form.telefono.trim() || null,
  };
}
