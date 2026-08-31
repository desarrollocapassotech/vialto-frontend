import { idFiscalPorPais } from '@/lib/ciudades';
import type { PaisCodigo } from '@/lib/ciudades';

type EntidadConPaisIdFiscal = 'cliente' | 'transportista';

export function validateNombrePaisIdFiscalForm(
  nombre: string,
  pais: PaisCodigo | '',
  idFiscal: string,
  entidad: EntidadConPaisIdFiscal,
  paisVisible: boolean = true,
  idFiscalVisible: boolean = true,
): string | null {
  if (!nombre.trim()) return `Ingresá el nombre del ${entidad}.`;
  if (paisVisible && !pais) return `Seleccioná el país del ${entidad}.`;
  if (idFiscalVisible && !idFiscal.trim()) {
    const label = idFiscalPorPais(pais).label;
    return `Ingresá el ${label.toLowerCase()} del ${entidad}.`;
  }
  return null;
}

export function validateClienteForm(
  nombre: string,
  pais: PaisCodigo | '',
  idFiscal: string,
  paisVisible: boolean = true,
  idFiscalVisible: boolean = true,
): string | null {
  return validateNombrePaisIdFiscalForm(nombre, pais, idFiscal, 'cliente', paisVisible, idFiscalVisible);
}

export function validateTransportistaForm(
  nombre: string,
  pais: PaisCodigo | '',
  idFiscal: string,
  paisVisible: boolean = true,
  idFiscalVisible: boolean = true,
): string | null {
  return validateNombrePaisIdFiscalForm(nombre, pais, idFiscal, 'transportista', paisVisible, idFiscalVisible);
}
