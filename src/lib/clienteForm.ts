import { idFiscalPorPais } from '@/lib/ciudades';
import type { PaisCodigo } from '@/lib/ciudades';

export function validateClienteForm(
  nombre: string,
  pais: PaisCodigo | '',
  idFiscal: string,
): string | null {
  if (!nombre.trim()) return 'Ingresá el nombre del cliente.';
  if (!pais) return 'Seleccioná el país del cliente.';
  if (!idFiscal.trim()) {
    const label = idFiscalPorPais(pais).label;
    return `Ingresá el ${label.toLowerCase()} del cliente.`;
  }
  return null;
}
