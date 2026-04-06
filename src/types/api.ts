/** Forma alineada con el modelo Prisma expuesto por el backend. */
export interface Viaje {
  id: string;
  tenantId: string;
  numero: string;
  estado: string;
  clienteId: string;
  transportistaId: string | null;
  choferId: string | null;
  vehiculoId: string | null;
  patenteTractor: string | null;
  patenteSemirremolque: string | null;
  origen: string | null;
  destino: string | null;
  fechaCarga: string | null;
  fechaDescarga: string | null;
  mercaderia: string | null;
  kmRecorridos: number | null;
  litrosConsumidos: number | null;
  monto: number | null;
  precioTransportistaExterno: number | null;
  documentacion: string[];
  observaciones: string | null;
  fechaFinalizado: string | null;
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

export interface PlatformUser {
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  platformRole?: string | null;
  createdAt: number | string;
}
