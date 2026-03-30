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
  origen: string | null;
  destino: string | null;
  fechaSalida: string | null;
  fechaLlegada: string | null;
  mercaderia: string | null;
  kmRecorridos: number | null;
  litrosConsumidos: number | null;
  precioCliente: number | null;
  precioFletero: number | null;
  gananciaBruta: number | null;
  documentacion: string[];
  observaciones: string | null;
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

/** Empresa registrada en Vialto. */
export interface Tenant {
  id: string;
  clerkOrgId: string;
  name: string;
  cuit: string | null;
  plan: string;
  modules: string[];
  maxUsers: number;
  billingStatus: string;
  billingRenewsAt: string | null;
  whiteLabelDomain: string | null;
  createdAt: string;
}
