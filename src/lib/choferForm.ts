import type { Chofer } from '@/types/api';

export type ChoferFormState = {
  nombre: string;
  dni: string;
  cuit: string;
  telefono: string;
  /** PIN para la app vialto-combustible. Vacío = no cambiar (edit) / no configurar (create). */
  pin?: string;
  /** Solo lectura. Indica si el chofer ya tiene PIN configurado en la BD. */
  pinConfigured?: boolean;
};

export function choferFormStateFromApi(row: Chofer): ChoferFormState {
  return {
    nombre: row.nombre ?? '',
    dni: row.dni ?? '',
    cuit: row.cuit ?? '',
    telefono: row.telefono ?? '',
    pinConfigured: row.pinConfigured ?? false,
    // pin nunca viene en la respuesta; se deja vacío para que el admin lo establezca si quiere
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

/** Valida el PIN solo si el campo no está vacío (siempre es opcional). */
export function validarPinForm(pin: string | undefined): string | null {
  if (!pin) return null;
  if (!/^\d{4}$/.test(pin)) return 'El PIN debe tener exactamente 4 dígitos numéricos.';
  return null;
}

/**
 * Cuerpo POST/PATCH alineado con CreateChoferDto / UpdateChoferDto.
 * Opcionales vacíos van como `null` (el backend debe preservar `null` en PATCH para borrar el valor).
 */
export function choferWritePayloadFromForm(
  form: ChoferFormState,
  transportistaId?: string | null,
): Record<string, unknown> {
  const dni = dniSoloDigitos(form.dni);
  const cuit = form.cuit.trim();
  const telefono = form.telefono.trim();
  const tid = transportistaId?.trim() ?? '';
  const pin = form.pin?.trim();
  return {
    nombre: form.nombre.trim(),
    dni: dni || null,
    cuit: cuit || null,
    telefono: telefono || null,
    ...(tid ? { transportistaId: tid } : {}),
    // pin solo se incluye si el admin ingresó un valor; vacío = no tocar el PIN existente
    ...(pin ? { pin } : {}),
  };
}
