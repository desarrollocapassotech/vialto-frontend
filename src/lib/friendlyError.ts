import { ApiError } from './api';

export type FriendlyErrorContext =
  | 'tablero'
  | 'viajes'
  | 'cargas'
  | 'clientes'
  | 'transportistas'
  | 'choferes'
  | 'vehiculos'
  | 'facturacion'
  | 'plataforma';

const fallback: Record<FriendlyErrorContext, string> = {
  tablero: 'No pudimos cargar el tablero. Probá de nuevo en un momento.',
  viajes: 'No pudimos cargar los viajes. Probá de nuevo en un momento.',
  cargas:
    'No pudimos cargar el catálogo de cargas. Probá de nuevo en un momento.',
  clientes: 'No pudimos cargar los clientes. Probá de nuevo en un momento.',
  transportistas:
    'No pudimos cargar los transportistas. Probá de nuevo en un momento.',
  choferes: 'No pudimos cargar los choferes. Probá de nuevo en un momento.',
  vehiculos: 'No pudimos cargar los vehículos. Probá de nuevo en un momento.',
  facturacion:
    'No pudimos cargar las facturas. Probá de nuevo en un momento.',
  plataforma:
    'No pudimos cargar el panorama de empresas. Probá de nuevo en un momento.',
};

/**
 * Mensajes para la persona usuaria, sin detalles técnicos ni textos del servidor.
 */
export function friendlyError(
  err: unknown,
  context: FriendlyErrorContext,
): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return 'Tu sesión venció. Volvé a iniciar sesión para seguir.';
    }
    if (err.status === 403) {
      if (context === 'viajes' || context === 'tablero' || context === 'cargas') {
        return 'Tu empresa todavía no tiene habilitada la gestión de viajes, o falta completar el registro. Consultá con quien administra la cuenta en tu organización.';
      }
      if (context === 'facturacion') {
        return 'Tu empresa no tiene habilitado el módulo de facturación. Consultá con el administrador de tu cuenta.';
      }
      return 'No tenés permiso para ver esto. Si necesitás acceso, pedilo a un administrador.';
    }
    if (err.status === 404) {
      return 'No encontramos lo que buscás.';
    }
    if (err.status === 400) {
      return 'Algunos datos no son válidos. Revisá la información e intentá de nuevo.';
    }
    if (err.status >= 500) {
      return 'Tuvimos un problema del nuestro. Intentá de nuevo más tarde.';
    }
  }
  return fallback[context];
}
