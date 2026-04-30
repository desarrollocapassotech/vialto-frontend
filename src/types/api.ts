/** Forma alineada con el modelo Prisma expuesto por el backend. */

export interface PagoTransportista {
  monto: number;
  moneda: 'ARS' | 'USD';
  fecha: string;
  observaciones?: string;
  metodo?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface OtroGasto {
  descripcion: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  fecha?: string;
  createdBy?: string;
}

export interface Carga {
  id: string;
  tenantId: string;
  nombre: string;
  descripcion: string | null;
  unidadMedida: string | null;
  activo: boolean;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

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
    vehiculo: Pick<Vehiculo, 'id' | 'patente' | 'tipo'>;
  }>;
  origen: string | null;
  destino: string | null;
  fechaCarga: string | null;
  fechaDescarga: string | null;
  /** Cargas del catálogo vinculadas al viaje (orden operativo). */
  cargasViaje?: Array<{
    id: string;
    cargaId: string;
    orden: number;
    carga: {
      id: string;
      nombre: string;
      activo: boolean;
      unidadMedida: string | null;
    };
  }>;
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
  otrosGastos?: OtroGasto[];
  pagosTransportista?: PagoTransportista[];
  fechaFinalizado: string | null;
  facturaId?: string | null;
  /** Denormalizado en el viaje; si falta, usar `factura.numero` del include. */
  nroFactura: string | null;
  factura?: { id: string; numero: string } | null;
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
  pais: string | null;
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
  nroChasis: string | null;
  poliza: string | null;
  vencimientoPoliza: string | null;
  tara: number | null;
  precinto: string | null;
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

export interface ImportRowError {
  fila: number;
  campo?: string;
  error: string;
  valor?: unknown;
}

export interface ImportPreviewViaje {
  fila: number;
  cliente: string;
  transporte: string | null;
  origen: string | null;
  destino: string | null;
  fechaCarga: string | null;
  fechaDescarga: string | null;
  detalleCarga: string | null;
  monto: number | null;
  nroFactura: string | null;
  precioTransportistaExterno: number | null;
  nroFacturaTransporte: string | null;
}

export interface ImportPreviewFactura {
  tipo: 'cliente' | 'transportista_externo';
  numero: string;
  nombre: string | null;
  importe: number;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
}

export interface ImportPreviewEntidad {
  nombre: string;
  esNuevo: boolean;
}

export interface ImportPreviewResult {
  sessionId: string;
  modulo: string;
  nombreArchivo: string;
  totalFilas: number;
  exitosas: number;
  errores: number;
  detalleErrores: ImportRowError[];
  viajes?: ImportPreviewViaje[];
  facturas?: ImportPreviewFactura[];
  clientes?: ImportPreviewEntidad[];
  transportistas?: ImportPreviewEntidad[];
}

export interface ImportLogDetalle {
  fila: number;
  estado: 'ok' | 'error';
  id?: string;
  mensaje?: string;
}

export interface ImportLog {
  id: string;
  tenantId: string;
  modulo: string;
  nombreArchivo: string;
  estado: 'completado' | 'con_errores' | 'fallido';
  totalFilas: number;
  exitosas: number;
  errores: number;
  detalles: ImportLogDetalle[];
  createdAt: string;
  createdBy: string;
}

export interface ImportTemplate {
  id: string;
  modulo: string;
  nombre: string;
  activo: boolean;
  updatedAt: string;
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
