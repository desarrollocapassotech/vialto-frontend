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
  /** Productos vinculados al viaje (orden operativo). */
  productosViaje?: Array<{
    id: string;
    productoId: string;
    orden: number;
    cantidad: number | null;
    pesoKg: number | null;
    producto: {
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
  idFiscal: string | null;
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
  cuit: string | null;
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
  pais: string | null;
  idFiscal: string | null;
  email: string | null;
  telefono: string | null;
  domicilio: string | null;
  condicionIva: number | null;
  condicionTributaria: string | null;
  /** En API siempre `externo` para subcontratistas; flota propia = sin vínculo en chofer/vehículo. */
  tipo?: string;
  paut: string | null;
  permisoInternacional: string | null;
  fechaVencimientoPermiso: string | null;
  createdAt: string;
}

/** Empresa registrada en Vialto. */
export interface Tenant {
  id: string;
  clerkOrgId: string;
  name: string;
  idFiscal: string | null;
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
  transportistaId: string | null;
  viajeIds: string[];
  importe: number;
  moneda: string;
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

export interface Presentacion {
  id: string;
  tenantId: string;
  productoId: string;
  nombre: string;
  cantidadEquivalente: number;
  unidadEquivalente: string;
  createdAt: string;
  updatedAt: string;
}

export interface Producto {
  id: string;
  tenantId: string;
  nombre: string;
  descripcion: string | null;
  unidadMedida: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  presentaciones?: Presentacion[];
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

export interface MovimientoStock {
  id: string;
  tenantId: string;
  productoId: string;
  producto?: { id: string; nombre: string; unidadMedida: string };
  presentacionId: string | null;
  presentacion?: { id: string; nombre: string } | null;
  clienteId: string;
  cliente?: { id: string; nombre: string };
  tipo: 'ingreso' | 'egreso' | 'division';
  cantidad: number;
  numeroRemito?: string | null;
  observaciones: string | null;
  remitoUrl: string | null;
  createdBy: string;
  /** Nombre o correo resuelto vía Clerk (solo en detalle). */
  createdByLabel?: string | null;
  fecha: string;
  createdAt: string;
}

export interface StockEgresoRemitoConfig {
  remitoPrefix: string;
  remitoDigitos: number;
}

// ── ARCA / Liquidaciones ──────────────────────────────────────────────────────

export interface ArcaConfig {
  cuitEmisor: string;
  razonSocial: string | null;
  domicilioEmisor: string | null;
  condicionIvaEmisor: string | null;
  ingBrutos: string | null;
  inicActEmisor: string | null;
  ptoVentaCvlp: number;
  ptoVentaFactura: number;
  ambiente: 'homologacion' | 'produccion';
  comisionPctDefault: number;
  comisionPctAlt: number;
  ivaGastosAdmin: number;
  updatedAt: string;
}

export type LiquidacionEstado = 'borrador' | 'pendiente_cae' | 'autorizado' | 'error' | 'anulado';

export interface Liquidacion {
  id: string;
  tenantId: string;
  transportistaId: string;
  periodoDesde: string;
  periodoHasta: string;
  cantViajes: number;
  bruto: number;
  comisionPct: number;
  comision: number;
  gastosAdmin: number;
  gastosAdminIva: number;
  liquido: number;
  cbteTipo: number;
  cbteNro: number | null;
  ptoVenta: number | null;
  cae: string | null;
  caeFechaVto: string | null;
  estado: LiquidacionEstado;
  arcaError: string | null;
  reintentos: number;
  createdAt: string;
  createdBy: string;
}

export interface ArcaLog {
  id: string;
  tenantId: string;
  liquidacionId: string | null;
  facturaId: string | null;
  method: string;
  ambiente: string;
  cuit: string;
  httpStatus: number | null;
  durationMs: number;
  exitoso: boolean;
  error: string | null;
  createdAt: string;
}

export interface StockItem {
  id: string;
  tenantId: string;
  productoId: string;
  producto?: { id: string; nombre: string; unidadMedida: string };
  presentacionId: string;
  presentacion?: { id: string; nombre: string };
  clienteId: string;
  cliente?: { id: string; nombre: string };
  cantidad: number;
  updatedAt: string;
}
