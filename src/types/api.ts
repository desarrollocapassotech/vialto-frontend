/** Forma alineada con el modelo Prisma expuesto por el backend. */
export interface Viaje {
  id: string;
  tenantId: string;
  numero: string;
  estado: string;
  clienteId: string;
  /** Presente en listados/detalle cuando el backend incluye la relación. */
  cliente?: { id: string; nombre: string };
  transportistaId: string | null;
  transportista?: { id: string; nombre: string } | null;
  choferId: string | null;
  /** Vehículos asociados al viaje (orden = orden operativo). */
  vehiculosViaje?: Array<{
    id: string;
    vehiculoId: string;
    orden: number;
    vehiculo: Vehiculo;
  }>;
  origen: string | null;
  destino: string | null;
  fechaCarga: string | null;
  fechaDescarga: string | null;
  detalleCarga: string | null;
  kmRecorridos: number | null;
  litrosConsumidos: number | null;
  monto: number | null;
  /** ARS | USD (omitido en respuestas antiguas → se trata como ARS). */
  monedaMonto?: string;
  precioTransportistaExterno: number | null;
  /** ARS | USD */
  monedaPrecioTransportistaExterno?: string;
  observaciones: string | null;
  fechaFinalizado: string | null;
  nroFactura: string | null;
  createdAt: string;
  createdBy: string;
}

/** Respuesta de GET /api/platform/* (superadmin). */
export type ConEmpresa<T> = T & { empresaNombre: string };

export interface Cliente {
  id: string;
  tenantId: string;
  nombre: string;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  createdAt: string;
}

export interface Chofer {
  id: string;
  tenantId: string;
  nombre: string;
  dni: string | null;
  licencia: string | null;
  licenciaVence: string | null;
  telefono: string | null;
  transportistaId: string | null;
  createdAt: string;
}

export interface Vehiculo {
  id: string;
  tenantId: string;
  patente: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  año: number | null;
  /** Respuesta JSON de Prisma/Nest usa `anio`. */
  anio?: number | null;
  kmActual: number;
  transportistaId: string | null;
  createdAt: string;
}

export interface Transportista {
  id: string;
  tenantId: string;
  nombre: string;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  /** En API siempre `externo` para subcontratistas; flota propia = sin vínculo en chofer/vehículo. */
  tipo?: string;
  createdAt: string;
}

/** Empresa registrada en Vialto. */
export interface Tenant {
  id: string;
  clerkOrgId: string;
  name: string;
  cuit: string | null;
  modules: string[];
  maxUsers: number;
  billingStatus: string;
  billingRenewsAt: string | null;
  whiteLabelDomain: string | null;
  createdAt: string;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PaginatedTenantsResponse {
  items: Tenant[];
  meta: PaginatedMeta;
}

export interface Pago {
  id: string;
  tenantId: string;
  facturaId: string;
  importe: number;
  fecha: string;
  formaPago: string | null;
  createdAt: string;
}

export interface Factura {
  id: string;
  tenantId: string;
  numero: string;
  tipo: 'cliente' | 'transportista_externo';
  clienteId: string | null;
  viajeIds: string[];
  importe: number;
  fechaEmision: string;
  fechaVencimiento: string | null;
  estado: 'pendiente' | 'cobrada' | 'vencida';
  diferencia: number | null;
  createdAt: string;
}

export interface PlatformUser {
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  platformRole?: string | null;
  createdAt: number | string;
}
