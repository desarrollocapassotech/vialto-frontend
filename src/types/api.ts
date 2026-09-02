/** Forma alineada con el modelo Prisma expuesto por el backend. */

export interface PagoTransportista {
  monto: number;
  moneda: "ARS" | "USD";
  fecha: string;
  observaciones?: string;
  metodo?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface OtroGasto {
  descripcion: string;
  monto: number;
  moneda: "ARS" | "USD";
  fecha?: string;
  createdBy?: string;
  /** Nombre o correo resuelto vía Clerk (solo en detalle). */
  createdByLabel?: string | null;
}

/** Cliente adicional de un viaje multi-cliente: origen/destino(s)/productos y cobro propios. */
export interface ViajeCliente {
  id: string;
  orden: number;
  clienteId: string;
  cliente?: { id: string; nombre: string; condicionIva?: number | null };
  origen: string | null;
  /** Denormalizado: último destino de la ruta de este cliente (legacy/compat). */
  destino: string | null;
  /** Destinos ordenados de este cliente (orden = secuencia de la ruta). */
  destinosCliente?: Array<{
    id: string;
    orden: number;
    etiqueta: string;
    createdAt?: string;
  }>;
  /** Productos que le corresponden a este cliente (orden operativo). */
  productosCliente?: Array<{
    id: string;
    productoId: string;
    orden: number;
    cantidad: number | null;
    pesoKg: number | null;
    producto: { id: string; nombre: string; activo: boolean };
  }>;
  /** Igual que Viaje.cantidadFactura/precioUnitarioFactura: si ambos vienen, `monto` = cantidad × precioUnitario. */
  monto: number | null;
  monedaMonto: string;
  cantidad: number | null;
  precioUnitario: number | null;
  facturaId?: string | null;
  facturacionEstado: string;
}

export interface Viaje {
  id: string;
  tenantId: string;
  numero: string;
  /** ID propio del cliente para identificar el viaje (ej. CTG). Si está cargado, reemplaza a `numero` en toda vista/documento humano. */
  numeroIdentificacionPersonalizado: string | null;
  /** @deprecated Reemplazado por `etapa` + `facturacionEstado` + `liquidacionEstado`. */
  estado: string;
  /** Etapa operativa del viaje: pendiente | en_curso | finalizado | cancelado. */
  etapa: string;
  /** Estado de facturación al cliente (derivado, no editable a mano). */
  facturacionEstado: string;
  /** Estado de liquidación al transportista (derivado); null si no aplica (sin transportista externo o tenant sin integración ARCA). */
  liquidacionEstado: string | null;
  clienteId: string;
  /** Presente en listados/detalle cuando el backend incluye la relación. */
  cliente?: { id: string; nombre: string; condicionIva?: number | null };
  transportistaId: string | null;
  transportista?: {
    id: string;
    nombre: string;
    condicionIva?: number | null;
  } | null;
  transportistaEfectivoId?: string | null;
  transportistaEfectivo?: { id: string; nombre: string } | null;
  choferId: string | null;
  /** Presente en listados/detalle cuando el backend incluye la relación. */
  chofer?: Pick<
    Chofer,
    "id" | "nombre" | "dni" | "cuit" | "telefono" | "transportistaId"
  > | null;
  /** Vehículos asociados al viaje (orden = orden operativo). */
  vehiculosViaje?: Array<{
    id: string;
    vehiculoId: string;
    orden: number;
    vehiculo: Pick<Vehiculo, "id" | "patente" | "tipo">;
  }>;
  origen: string | null;
  /** Denormalizado: último destino de la ruta (legacy / compat). */
  destino: string | null;
  /** Destinos ordenados del viaje (orden = secuencia de la ruta). */
  destinosViaje?: Array<{
    id: string;
    orden: number;
    etiqueta: string;
    createdAt?: string;
  }>;
  /** Clientes adicionales del viaje (multi-cliente, opcional) — conviven con `clienteId`, no lo reemplazan. */
  clientesViaje?: ViajeCliente[];
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
    };
  }>;
  detalleCarga: string | null;
  kmRecorridos: number | null;
  litrosConsumidos: number | null;
  monto: number | null;
  cantidadFactura?: number | null;
  precioUnitarioFactura?: number | null;
  /** ARS | USD (omitido en respuestas antiguas -> se trata como ARS). */
  monedaMonto?: string;
  precioTransportistaExterno: number | null;
  cantidadTransportista?: number | null;
  precioUnitarioTransportista?: number | null;
  /** ARS | USD */
  monedaPrecioTransportistaExterno?: string;
  /** % de IVA que el transportista suma en efectivo por encima de precioTransportistaExterno (que siempre es neto). 0 = no suma IVA. No afecta el cálculo de la Liquidación/CVLP, solo el pago en efectivo y la ganancia bruta. */
  precioTransportistaIvaIncluidoPct?: number;
  /** Solo cuando monedaMonto != monedaPrecioTransportistaExterno (transporte externo). */
  gananciaBrutaManual?: number | null;
  monedaGananciaBrutaManual?: string | null;
  observaciones: string | null;
  otrosGastos?: OtroGasto[];
  pagosTransportista?: PagoTransportista[];
  fechaFinalizado: string | null;
  facturaId?: string | null;
  /** Denormalizado en el viaje; si falta, usar `factura.numero` del include. */
  nroFactura: string | null;
  factura?: {
    id: string;
    numero: string;
    importe?: number;
    moneda?: string;
    estado: string;
    arcaEstado?: string | null;
    arcaError?: string | null;
    cae?: string | null;
    caeFechaVto?: string | null;
    cbteNro?: number | null;
    ptoVenta?: number | null;
    fechaEmision?: string;
  } | null;
  liquidacionesViaje?: {
    liquidacionId: string;
    monto?: number;
    liquidacion: {
      id: string;
      estado: string;
      liquido: number;
      arcaError?: string | null;
      cae?: string | null;
      caeFechaVto?: string | null;
      cbteNro?: number | null;
      ptoVenta?: number | null;
      ambiente?: string | null;
      periodoDesde?: string;
      periodoHasta?: string;
      motivoAnulacion?: string | null;
      anuladoAt?: string | null;
    };
  }[];
  createdAt: string;
  createdBy: string;
  montoFacturadoReal?: number | null;
  /** Moneda de la factura */
  monedaMontoFacturadoReal?: string | null;
  /** Costo real prorrateado a partir del líquido de la liquidación emitida (sin anulaciones) */
  costoLiquidadoReal?: number | null;
  /** Moneda de la liquidación (generalmente ARS para AFIP) */
  monedaCostoLiquidadoReal?: string | null;
}

/** Liquidación asociada a un viaje, devuelta por DELETE /viajes/:id cuando hay impacto. */
export interface ViajeEliminacionLiquidacionImpacto {
  id: string;
  transportistaNombre: string;
  estado: LiquidacionEstado;
  tieneCae: boolean;
  cbteNro: number | null;
  ptoVenta: number | null;
  periodoDesde: string;
  periodoHasta: string;
}

/** Body de error 409 de DELETE /viajes/:id cuando el viaje tiene liquidaciones asociadas. */
export interface ViajeEliminacionConflicto {
  message: string;
  code: "VIAJE_LIQUIDACION_AUTORIZADA" | "VIAJE_TIENE_LIQUIDACIONES";
  liquidaciones: ViajeEliminacionLiquidacionImpacto[];
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
  condicionIva: number | null;
  condicionTributaria: string | null;
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
  /** true si el chofer tiene PIN configurado para la app vialto-combustible. El hash nunca se expone. */
  pinConfigured?: boolean;
  /** false = no puede loguearse en la app vialto-combustible. */
  activo: boolean;
  createdAt: string;
}

export type Pais = {
  id: string;
  tenantId: string;
  nombre: string;
  codigo: string | null;
  esPredefinido: boolean;
  createdAt: string;
  createdBy: string | null;
};

export interface Destinatario {
  id: string;
  tenantId: string;
  nombre: string;
  createdAt: string;
}

export interface DireccionEntrega {
  id: string;
  tenantId: string;
  direccion: string;
  createdAt: string;
}

export interface Vehiculo {
  id: string;
  tenantId: string;
  patente: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  año?: number | null;
  anio: number | null;
  kmActual: number;
  nroChasis: string | null;
  poliza: string | null;
  vencimientoPoliza: string | null;
  tara: number | null;
  precinto: string | null;
  transportistaId: string | null;
  activo: boolean;
  createdAt: string;
}

export type TipoIntervencionMantenimiento =
  // Motor y sistema de propulsión
  | 'cambio_aceite_motor'
  | 'revision_filtros'
  | 'inspeccion_bandas_correas'
  | 'calibracion_valvulas'
  | 'revision_inyectores'
  | 'inspeccion_turbocompresor'
  // Sistema de frenos
  | 'revision_balatas_pastillas'
  | 'rectificacion_tambores_discos'
  | 'mantenimiento_sistema_aire'
  | 'prueba_camaras_freno'
  | 'ajuste_matracas'
  // Tren motriz, suspensión y dirección
  | 'servicio_transmision'
  | 'servicio_diferencial'
  | 'engrasado_chasis'
  | 'alineacion_balanceo'
  | 'revision_suspension'
  | 'inspeccion_rodamientos'
  // Sistema eléctrico y electrónico
  | 'diagnostico_escaner'
  | 'prueba_baterias'
  | 'control_alternador'
  | 'inspeccion_luces'
  // Sistema de carga y acople
  | 'mantenimiento_quinta_rueda'
  | 'revision_perno_rey'
  | 'inspeccion_lineas_acople'
  // Neumáticos
  | 'rotacion_cubiertas'
  | 'cambio_cubiertas'
  | 'reparacion_pinchadura'
  // Catch-all
  | 'otro';

export interface Intervencion {
  id: string;
  tenantId: string;
  vehiculoId: string;
  tipos: TipoIntervencionMantenimiento[];
  descripcion: string | null;
  km: number | null;
  proximoKm: number | null;
  proximaFecha: string | null;
  fecha: string;
  createdAt: string;
  createdBy: string;
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
  /** En API siempre `externo` para subcontratistas; flota propia = sin vinculo en chofer/vehiculo. */
  tipo?: string;
  paut: string | null;
  permisoInternacional: string | null;
  fechaVencimientoPermiso: string | null;
  comisionPct: number | null;
  createdAt: string;
}

export interface Deposito {
  id: string;
  tenantId: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
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
  /** Label del campo "ID propio" en el módulo de viajes, personalizable por tenant (ej. "Nro de CTG"). */
  labelIdentificacionPersonalizadaViajes: string | null;
  /** true = el admin del tenant no ve la pantalla de import masivo (superadmin sigue pudiendo usarla). */
  importacionesOcultas: boolean;
  /**
   * Método de anulación del CVLP (060) — 'nota_credito_debito' (default, todo tenant nuevo) |
   * 'manual'. Solo editable desde superadmin (panel Empresas). Ver Liquidacion.estado.
   */
  liquidacionAnulacionMetodo: string;
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

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export interface PaginatedTenantsResponse {
  items: Tenant[];
  meta: PaginatedMeta;
}

export interface CargaCombustible {
  id: string;
  tenantId: string;
  vehiculoId: string | null;
  vehiculo: { patente: string } | null;
  choferId: string | null;
  chofer: { nombre: string } | null;
  estacion: string;
  litros: number;
  precioPorLitro: number;
  importe: number;
  km: number;
  formaPago: string | null;
  fecha: string;
  createdAt: string;
  createdBy: string;
  fotoTacometro?: string | null;
  fotoTicket?: string | null;
  sospechoso: boolean;
  motivoSospecha: string | null;
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

export interface FacturaTramo {
  id: string;
  viajeId: string;
  detalle: string;
  monto: number;
  ivaPct: number;
  orden: number;
}

export interface Factura {
  id: string;
  tenantId: string;
  /** Null para tenants con integracion-arca hasta que se emite (el número real lo asigna AFIP). */
  numero: string | null;
  /** Siempre "cliente" — el pago a transportistas externos se gestiona en Liquidaciones, no como Factura. */
  tipo: "cliente";
  clienteId: string | null;
  transportistaId: string | null;
  viajeIds: string[];
  /** Neto: suma completa de los viajes, sin IVA. */
  importe: number;
  /**
   * IVA total persistido al guardar (solo facturas por tramo sin ARCA).
   * Null = no aplica o todavía no backfilleado.
   */
  ivaMonto?: number | null;
  /**
   * Monto contra el que se mide el cobro. En facturas por tramo de tenants
   * sin ARCA es neto + `ivaMonto`; en el resto coincide con `importe`.
   */
  importeACobrar?: number;
  /** `max(0, importeACobrar − pagos)`. */
  saldoPendiente?: number;
  moneda: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  /** Ciclo de vida del comprobante. Independiente de `cobrado`/`vencida` — no se reemplazan entre sí. */
  estado: "borrador" | "esperando_afip" | "facturado" | "error_afip" | "anulado";
  /** Se puede estar cobrado en cualquier `estado` (ej. cobrado antes de anular). */
  cobrado: boolean;
  /** Solo relevante mientras no está cobrado y ya se llegó a "facturado". */
  vencida: boolean;
  diferencia: number | null;
  ivaPct: number | null;
  /**
   * Si true, el IVA se arma por tramo; el neto (`importe`) sigue siendo la
   * suma completa de los viajes (la parte no cubierta usa `ivaPct`).
   */
  facturarPorTramo?: boolean;
  tramos?: FacturaTramo[];
  comprobanteUrl: string | null;
  cbteTipo?: number | null;
  cbteNro?: number | null;
  ptoVenta?: number | null;
  cae?: string | null;
  caeFechaVto?: string | null;
  arcaEstado?: "pendiente_cae" | "autorizado" | "error" | "anulado" | null;
  arcaError?: string | null;
  /** Ambiente ARCA con el que se autorizó (snapshot; homologacion | produccion). Null si no aplica. */
  ambiente?: string | null;
  /** Datos del comprobante de anulación (Nota de Crédito A/B); la factura original se conserva arriba. */
  anulacionCbteTipo?: number | null;
  anulacionCbteNro?: number | null;
  anulacionPtoVenta?: number | null;
  anulacionCae?: string | null;
  anulacionCaeFechaVto?: string | null;
  anulacionFecha?: string | null;
  motivoAnulacion?: string | null;
  anuladoPor?: string | null;
  anuladoPorNombre?: string | null;
  anuladoAt?: string | null;
  /** PDF de la NC en Cloudinary (equivalente a comprobanteUrl del original). */
  notaCreditoUrl?: string | null;
  createdAt: string;
}

export interface FacturaLineaPayload {
  descripcion: string;
  importe: number;
  ivaPct?: number;
}

export interface ImportRowError {
  fila: number;
  campo?: string;
  error: string;
  valor?: unknown;
  /** Si el error es un lookup no encontrado: qué modelo se buscó (clientes/transportistas/choferes/vehiculos/productos). */
  lookupModel?: string;
}

export interface ImportCiudadAdvertencia {
  fila: number;
  campo: "origen" | "destino";
  valor: string;
  mensaje: string;
}

export interface ImportPreviewViaje {
  fila: number;
  cliente: string;
  transporte: string | null;
  origen: string | null;
  destino: string | null;
  chofer: string | null;
  vehiculo: string | null;
  fechaCarga: string | null;
  fechaDescarga: string | null;
  detalleCarga: string | null;
  monto: number | null;
  monedaMonto: string | null;
  nroFactura: string | null;
  precioTransportistaExterno: number | null;
  monedaPrecioTransportistaExterno: string | null;
  /** Advertencias de validación de catálogo (no bloquean la importación). */
  advertenciasCiudad?: ImportCiudadAdvertencia[];
  /** true = este viaje no existe todavía (alta nueva). false = actualiza uno existente. */
  nuevo: boolean;
  /** Solo si `nuevo` es false: campos que cambian respecto al valor actual, con su antes/después. */
  cambios?: { campo: string; antes: string | number | null; despues: string | number | null }[];
}

export interface ImportPreviewFactura {
  /** Siempre "cliente": el pago al transportista se liquida por afuera (Liquidaciones), no como Factura. */
  tipo: "cliente";
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

export interface ImportPreviewFilaCampo {
  campo: string;
  label: string;
  valor: string;
}

/** Detalle fila por fila de un módulo "simple" (Clientes/Transportistas/Choferes/Vehículos): todas las columnas configuradas con su valor tal como viene del Excel, no solo el nombre. */
export interface ImportPreviewFilaEntidad {
  fila: number;
  /** true = alta nueva, false = actualiza un registro ya existente. */
  esNuevo: boolean;
  campos: ImportPreviewFilaCampo[];
}

export interface ImportEntidadFaltante {
  valor: string;
  /** Sugerencia por una regla simple (posición en el par tractor/semirremolque), no IA. */
  tipoSugerido?: string | null;
}

export interface ImportEntidadesFaltantesModelo {
  modelo: string;
  valores: ImportEntidadFaltante[];
}

export interface ImportPreviewResult {
  sessionId: string;
  modulo: string;
  nombreArchivo: string;
  totalFilas: number;
  exitosas: number;
  errores: number;
  detalleErrores: ImportRowError[];
  /** Columnas del Excel que no matchean ningún campo del template — van a texto libre en Observaciones. */
  headersNoMapeados: string[];
  /** Columnas del template (no obligatorias) que no se encontraron en el Excel. */
  columnasOpcionalesFaltantes: string[];
  /** Entidades referenciadas por lookup que no existen todavía, agrupadas por modelo. */
  entidadesFaltantes: ImportEntidadesFaltantesModelo[];
  /** Filas que se importarían igual pero con algún campo recomendado (ej. CUIT/país) vacío — requieren confirmación explícita. */
  advertenciasCamposFaltantes: { fila: number; campos: string[] }[];
  /** Desglose de `exitosas` entre altas y actualizaciones (upsert por nombre/patente) — no viene para todos los módulos. */
  entidadesNuevas?: number;
  entidadesActualizadas?: number;
  /** Solo viajes: números de factura compartidos por más de un viaje nuevo (o ya existentes) — se unifican en una sola factura, requiere confirmación explícita. */
  advertenciasFacturasDuplicadas?: { numero: string; filas: number[] }[];
  /** Advertencias de ciudades no reconocidas en el catálogo (solo viajes). */
  advertenciasCiudad?: ImportCiudadAdvertencia[];
  totalAdvertenciasCiudad?: number;
  viajes?: ImportPreviewViaje[];
  facturas?: ImportPreviewFactura[];
  clientes?: ImportPreviewEntidad[];
  transportistas?: ImportPreviewEntidad[];
  /** Solo módulos "simples" (Clientes, Transportistas, Choferes, Vehículos): detalle fila por fila con todas las columnas del Excel + si es alta nueva o actualiza uno existente. */
  filasDetalle?: ImportPreviewFilaEntidad[];
}

export interface ImportLogDetalle {
  fila: number;
  estado: "ok" | "error" | "omitida";
  id?: string;
  /** Solo cuando estado="ok": true = alta nueva, false = actualizó un registro existente. */
  creado?: boolean;
  /** Solo viajes: true = esta fila quedó con una factura individual adjunta (por nroFactura). */
  facturado?: boolean;
  mensaje?: string;
}

export interface ImportLog {
  id: string;
  tenantId: string;
  modulo: string;
  nombreArchivo: string;
  estado: "completado" | "con_errores" | "fallido";
  totalFilas: number;
  exitosas: number;
  errores: number;
  detalles: ImportLogDetalle[];
  createdAt: string;
  createdBy: string;
}

/** Preview de una liquidación borrador a generar (agrupada por transportista), etapa opcional posterior a Viajes. */
export interface ImportLiquidacionPreviewGrupo {
  transportistaId: string;
  transportistaNombre: string;
  cantidadViajes: number;
  periodoDesde: string;
  periodoHasta: string;
  bruto: number;
}

/** Preview de una factura a cliente a generar (agrupada por cliente), etapa opcional posterior a Viajes. */
export interface ImportFacturaClientePreviewGrupo {
  clienteId: string;
  clienteNombre: string;
  cantidadViajes: number;
  importe: number;
  moneda: string;
}

export interface ImportTemplate {
  id: string;
  modulo: string;
  nombre: string;
  activo: boolean;
  config: {
    sheet?: string | number;
    headerRow?: number;
    columns: Array<{
      field: string;
      excelHeader: string;
      required?: boolean;
      defaultValue?: string;
      createIfNotFound?: boolean;
    }>;
  };
  updatedAt: string;
}

export interface ProductoPresentacion {
  id: string;
  presentacionId: string;
  presentacion?: { id: string; nombre: string };
  unidadesPorBulto: number;
  activo: boolean;
}

export interface Producto {
  id: string;
  tenantId: string;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  pesoUnitarioKg: number | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  productoPresentaciones: ProductoPresentacion[];
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

export interface Presentacion {
  id: string;
  tenantId: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MovimientoStock {
  id: string;
  tenantId: string;
  operacionId?: string;
  productoId: string;
  producto?: {
    id: string;
    nombre: string;
    unidad1Nombre: string;
    unidad2Nombre: string | null;
  };
  presentacionId?: string | null;
  presentacion?: ProductoPresentacion | null;
  clienteId: string;
  cliente?: { id: string; nombre: string };
  depositoId: string;
  deposito?: { id: string; nombre: string };
  tipo: "ingreso" | "egreso" | "division";
  cantidad1: number;
  cantidad2: number;
  numeroRemito?: string | null;
  lote?: string | null;
  fechaVencimiento?: string | null;
  observaciones: string | null;
  /** PDF del remito interno (solo egresos). */
  remitoUrl: string | null;
  movimientoVinculadoId?: string | null;
  createdBy: string;
  /** Nombre o correo resuelto via Clerk (solo en detalle). */
  createdByLabel?: string | null;
  fecha: string;
  createdAt: string;
  entregadoPor?: string | null;
  destinatario?: string | null;
  destinoFinal?: string | null;
  numeroDocumentoExterno?: string | null;
  /** Fotos del producto (solo ingresos). */
  fotosUrls?: string[];
}

export interface StockEgresoRemitoConfig {
  remitoPrefix: string;
  remitoDigitos: number;
}

// ARCA / Liquidaciones

export interface ArcaConfig {
  cuitEmisor: string;
  razonSocial: string | null;
  domicilioEmisor: string | null;
  condicionIvaEmisor: string | null;
  ingBrutos: string | null;
  inicActEmisor: string | null;
  logoUrl: string | null;
  ptoVentaCvlp: number;
  ptoVentaFactura: number;
  ambiente: "homologacion" | "produccion";
  comisionPctDefault: number;
  ivaGastosAdmin: number;
  /** Comprobante con que se anula un CVLP: 'nota_credito' (tipo 3/8) | 'nota_debito' (tipo 2/7). */
  anulacionTipoComprobante?: "nota_credito" | "nota_debito";
  updatedAt: string;
  /** En homologación se usa el CUIT de prueba de AFIP sin certificado propio; solo hace falta para producción. */
  certConfiguradoProduccion: boolean;
  keyConfiguradoProduccion: boolean;
}

export type LiquidacionEstado =
  | "borrador"
  | "pendiente_cae"
  | "autorizado"
  | "error"
  | "anulado"
  | "pendiente_anulacion";

export type ConceptoLiquidacionSigno = "favor" | "contra";

export interface ConceptoLiquidacion {
  id: string;
  tenantId: string;
  nombre: string;
  signo: ConceptoLiquidacionSigno;
  ivaPct: number;
  monto: number | null;
  bloqueado: boolean;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LiquidacionConceptoLinea {
  id: string;
  conceptoLiquidacionId: string | null;
  nombreSnapshot: string;
  signo: ConceptoLiquidacionSigno;
  /** null = heredar el IVA de la liquidación; 0 = exento. */
  ivaPct: number | null;
  monto: number;
  orden: number;
  modoAplicacion: string;
  viajeId: string | null;
}

/** Viaje incluido en una liquidación (join liquidacion_viajes + viaje). */
export interface LiquidacionViajeItem {
  viajeId: string;
  subtotal: number;
  viaje?: {
    id: string;
    numero: string | number | null;
    numeroIdentificacionPersonalizado?: string | null;
    fechaCarga: string | null;
    origen: string | null;
    destino: string | null;
  } | null;
}

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
  /** Alícuota IVA (%) aplicada a esta liquidación (snapshot). */
  ivaPct?: number;
  gastosAdmin: number;
  gastosAdminIva: number;
  liquido: number;
  cbteTipo: number;
  cbteNro: number | null;
  ptoVenta: number | null;
  cae: string | null;
  caeFechaVto: string | null;
  /** Ambiente ARCA en el que se emitió el comprobante (homologacion | produccion). */
  ambiente?: string | null;
  /** Datos del comprobante de anulación (Nota de Crédito o Débito); el CVLP original se conserva arriba. */
  anulacionCbteTipo?: number | null;
  anulacionCbteNro?: number | null;
  anulacionPtoVenta?: number | null;
  anulacionCae?: string | null;
  anulacionCaeFechaVto?: string | null;
  anulacionFecha?: string | null;
  estado: LiquidacionEstado;
  arcaError: string | null;
  /** Detalle técnico crudo de AFIP SDK del último error (para "ver error completo"). */
  arcaErrorDetalle?: string | null;
  reintentos: number;
  comprobanteUrl: string | null;
  motivoAnulacion?: string | null;
  anuladoPor?: string | null;
  /** Nombre legible resuelto desde Clerk (virtual; no se persiste). */
  anuladoPorNombre?: string | null;
  anuladoAt?: string | null;
  /** Método usado en esta anulación puntual (snapshot): 'nota_credito_debito' | 'manual'. */
  anulacionMetodo?: string | null;
  /** Anulación manual (Tenant.liquidacionAnulacionMetodo = 'manual'): auditoría del paso
   * "pendiente_anulacion" + comprobante pre-impreso adjunto al confirmar. */
  anulacionPendienteDesde?: string | null;
  anulacionPendientePor?: string | null;
  anulacionManualComprobanteUrl?: string | null;
  createdAt: string;
  createdBy: string;
  conceptosLineas?: LiquidacionConceptoLinea[];
  /** Presente en GET detalle; no siempre en el listado. */
  viajes?: LiquidacionViajeItem[];
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
  producto?: {
    id: string;
    nombre: string;
    unidad1Nombre: string;
    unidad2Nombre: string | null;
  };
  presentacionId: string;
  presentacion?: ProductoPresentacion;
  clienteId: string;
  cliente?: { id: string; nombre: string };
  depositoId: string;
  deposito?: { id: string; nombre: string };
  cantidad1: number;
  cantidad2: number;
  updatedAt: string;
  kg: number;
}

export interface StockOperacionLinea {
  id: string;
  productoId: string;
  producto?: {
    id: string;
    nombre: string;
    unidad1Nombre?: string;
    unidad2Nombre?: string | null;
  };
  presentacionId?: string | null;
  presentacion?: ProductoPresentacion | null;
  bultos: number;
  /** Unidades sueltas. */
  unidades: number;
  lote?: string | null;
  fechaVencimiento?: string | null;
  kg: number;
}

export interface StockOperacion {
  id: string;
  tenantId: string;
  tipo: "ingreso" | "egreso" | "division";
  fecha: string;
  clienteId: string;
  cliente?: { id: string; nombre: string };
  depositoId: string;
  deposito?: { id: string; nombre: string };
  /** PDF del remito interno generado al egresar. */
  remitoUrl?: string | null;
  numeroRemito?: string | null;
  /** Número de remito del proveedor, informado manualmente al registrar un ingreso. */
  numeroRemitoProveedor?: string | null;
  entregadoPor?: string | null;
  destinatario?: string | null;
  destinoFinal?: string | null;
  numeroDocumentoExterno?: string | null;
  observaciones?: string | null;
  /** Fotos del producto (solo ingresos). */
  fotosUrls?: string[];
  createdBy: string;
  createdAt: string;
  movimientos: StockOperacionLinea[];
}
