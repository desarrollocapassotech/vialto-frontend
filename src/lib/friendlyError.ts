import { ApiError } from "./api";
import { sanitizeArcaApiError } from "./arcaFriendlyError";

export type FriendlyErrorContext =
  | "tablero"
  | "viajes"
  | "cargas"
  | "clientes"
  | "transportistas"
  | "choferes"
  | "destinatarios"
  | "vehiculos"
  | "direccionesEntrega"
  | "facturacion"
  | "liquidaciones"
  | "stock"
  | "combustible"
  | "plataforma"
  | "arca"
  | "usuarios"
  | "camposEmpresa";

const fallback: Record<FriendlyErrorContext, string> = {
  tablero: "No pudimos cargar el tablero. Probá de nuevo en un momento.",
  viajes: "No pudimos cargar los viajes. Probá de nuevo en un momento.",
  cargas:
    "No pudimos cargar el catálogo de cargas. Probá de nuevo en un momento.",
  clientes: "No pudimos cargar los clientes. Probá de nuevo en un momento.",
  transportistas:
    "No pudimos cargar los transportistas. Probá de nuevo en un momento.",
  choferes: "No pudimos cargar los choferes. Probá de nuevo en un momento.",
  destinatarios:
    "No pudimos cargar los destinatarios. Probá de nuevo en un momento.",
  vehiculos: "No pudimos cargar los vehículos. Probá de nuevo en un momento.",
  direccionesEntrega:
    "No pudimos cargar las direcciones de entrega. Probá de nuevo en un momento.",
  facturacion: "No pudimos cargar las facturas. Probá de nuevo en un momento.",
  liquidaciones:
    "No pudimos completar la liquidación. Revisá los datos e intentá de nuevo.",
  stock:
    "No pudimos cargar el catálogo de productos. Probá de nuevo en un momento.",
  combustible:
    "No pudimos cargar las cargas de combustible. Probá de nuevo en un momento.",
  plataforma:
    "No pudimos cargar el panorama de empresas. Probá de nuevo en un momento.",
  arca: "No pudimos conectar con ARCA / AFIP SDK. Revisá la configuración e intentá de nuevo.",
  usuarios: "No pudimos cargar los usuarios. Probá de nuevo en un momento.",
  camposEmpresa:
    "No pudimos cargar la configuración de campos. Probá de nuevo en un momento.",
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
      return "Tu sesión venció. Volvé a iniciar sesión para seguir.";
    }
    if (err.status === 403) {
      if (
        context === "viajes" ||
        context === "tablero" ||
        context === "cargas"
      ) {
        return "Tu empresa todavía no tiene habilitada la gestión de viajes, o falta completar el registro. Consultá con quien administra la cuenta en tu organización.";
      }
      if (context === "facturacion" || context === "liquidaciones") {
        return "Tu empresa no tiene habilitado el módulo de facturación. Consultá con el administrador de tu cuenta.";
      }
      return "No tenés permiso para ver esto. Si necesitás acceso, pedilo a un administrador.";
    }
    if (err.status === 404) {
      if (
        err.message &&
        err.message !== "Not Found" &&
        !err.message.match(/^HTTP \d+$/i)
      ) {
        return err.message;
      }
      return "No encontramos lo que buscás.";
    }
    if (err.status === 409) {
      // Conflicto de integridad referencial / entidad en uso.
      // El backend (ConflictException de Nest) envía el mensaje específico.
      if (
        err.message &&
        err.message !== "Conflict" &&
        !err.message.match(/^HTTP \d+$/i)
      ) {
        return err.message;
      }
      return "No se puede completar la acción porque el registro está siendo utilizado por otros elementos.";
    }
    if (err.status === 400) {
      if (err.message && err.message !== "Bad Request") return err.message;
      return "Algunos datos no son válidos. Revisá la información e intentá de nuevo.";
    }
    if (err.status === 422) {
      if (
        err.message &&
        err.message !== "Unprocessable Entity" &&
        !err.message.match(/^HTTP \d+$/i)
      ) {
        if (context === "arca") {
          return sanitizeArcaApiError(err.message) ?? fallback.arca;
        }
        return err.message;
      }
    }
    if (err.status === 502 || err.status === 503) {
      if (
        err.message &&
        err.message !== "Bad Gateway" &&
        err.message !== "Service Unavailable"
      ) {
        return err.message;
      }
    }
    if (err.status >= 500) {
      return "Tuvimos un problema del nuestro. Intentá de nuevo más tarde.";
    }
    if (
      err.message &&
      err.message !== "Conflict" &&
      !err.message.match(/^HTTP \d+$/i)
    ) {
      return err.message;
    }
  }
  return fallback[context];
}
