import type { Chofer } from '@/types/api';

export type ChoferFormState = {
  nombre: string;
  dni: string;
  cuit: string;
  telefono: string;
  licencia: string;
  licenciaVence: string;
  /** Vacío = flota propia; cuid = transportista externo. */
  transportistaId: string;
  /** PIN para la app vialto-combustible. Vacío = no cambiar (edit) / no configurar (create). */
  pin?: string;
  /** Solo lectura. Indica si el chofer ya tiene PIN configurado en la BD. */
  pinConfigured?: boolean;
};

/** Valor para `<input type="date">` sin corrimiento por zona horaria. */
export function choferLicenciaVenceInputValue(
  iso: string | null | undefined,
): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function choferFormStateFromApi(row: Chofer): ChoferFormState {
  return {
    nombre: row.nombre ?? '',
    dni: row.dni ?? '',
    cuit: row.cuit ?? '',
    telefono: row.telefono ?? '',
    licencia: row.licencia ?? '',
    licenciaVence: choferLicenciaVenceInputValue(row.licenciaVence),
    transportistaId: row.transportistaId ?? '',
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
 * `transportistaId: null` = flota propia.
 */
export function choferWritePayloadFromForm(
  form: ChoferFormState,
  /** Override puntual (p. ej. ChoferModal desde un viaje externo). */
  transportistaIdOverride?: string | null,
): Record<string, unknown> {
  const dni = dniSoloDigitos(form.dni);
  const cuit = form.cuit.trim();
  const telefono = form.telefono.trim();
  const licencia = form.licencia.trim();
  const licenciaVence = form.licenciaVence.trim();
  const pin = form.pin?.trim();
  const tid =
    transportistaIdOverride !== undefined
      ? transportistaIdOverride?.trim() || null
      : form.transportistaId.trim() || null;
  return {
    nombre: form.nombre.trim(),
    dni: dni || null,
    cuit: cuit || null,
    telefono: telefono || null,
    licencia: licencia || null,
    licenciaVence: licenciaVence || null,
    transportistaId: tid,
    // pin solo se incluye si el admin ingresó un valor; vacío = no tocar el PIN existente
    ...(pin ? { pin } : {}),
  };
}
