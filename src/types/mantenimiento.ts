/**
 * Tipos del módulo Mantenimiento — espejo de las respuestas de `/api/mantenimiento/*`
 * (vialto-backend/src/modules/mantenimiento). Fechas como ISO string (medianoche UTC).
 */

export type TareaMantenimiento =
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

export type CategoriaPlan = 'mecanico' | 'documental';
export type EstadoVencimiento = 'vencido' | 'proximo' | 'sin_datos' | 'ok';
export type FuenteKm = 'carga' | 'edicion' | 'orden_trabajo' | 'vehiculo' | (string & {});

/** Una fila del semáforo: un plan asignado a una unidad (`GET mantenimiento/vencimientos`). */
export interface FilaVencimiento {
  vehiculoPlanId: string;
  vehiculo: { id: string; patente: string; tipo: string };
  plan: {
    id: string;
    nombre: string;
    categoria: CategoriaPlan;
    intervaloKm: number | null;
    intervaloDias: number | null;
    avisoKm: number | null;
    avisoDias: number | null;
    tareas: TareaMantenimiento[];
  };
  referencia: {
    tipo: 'orden' | 'base';
    id: string;
    ordenNumero: number | null;
    km: number | null;
    fecha: string | null;
  } | null;
  odometro: { km: number; fecha: string; fuente: FuenteKm; fuenteId: string } | null;
  kmPorDia: number | null;
  estado: EstadoVencimiento;
  proximoKm: number | null;
  kmRestantes: number | null;
  proximaFecha: string | null;
  diasRestantes: number | null;
  fechaEstimada: string | null;
  motivo: 'km' | 'fecha' | null;
}

export type TipoOrden = 'preventivo' | 'correctivo';
export type EstadoOrden = 'abierta' | 'en_curso' | 'cerrada' | 'anulada';

export interface Taller {
  id: string;
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  activo: boolean;
  _count?: { ordenes: number };
}

/** Fila del listado paginado (`GET mantenimiento/ordenes`). */
export interface OrdenTrabajo {
  id: string;
  numero: number;
  vehiculoId: string;
  tipo: TipoOrden;
  origen: 'manual' | 'plan' | (string & {});
  estado: EstadoOrden;
  tallerId: string | null;
  fecha: string;
  km: number | null;
  tareas: TareaMantenimiento[];
  descripcion: string | null;
  costoTotal: number;
  adjuntos: string[];
  createdAt: string;
  vehiculo: { id: string; patente: string; tipo: string };
  taller: { id: string; nombre: string } | null;
  _count: { items: number; planes: number };
}

export interface ItemOrden {
  id: string;
  tipo: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

/** Detalle (`GET mantenimiento/ordenes/:id`). */
export interface OrdenTrabajoDetalle extends Omit<OrdenTrabajo, '_count'> {
  items: ItemOrden[];
  planes: Array<{
    vehiculoPlanId: string;
    vehiculoPlan: { id: string; planId: string; plan: { id: string; nombre: string; categoria: CategoriaPlan } };
  }>;
}

/** Respuesta de alta/edición: el detalle + aviso (no bloqueante) si el km no cierra con el odómetro. */
export type OrdenTrabajoGuardada = OrdenTrabajoDetalle & { warning: string | null };

/** Plan asignado a una unidad (`GET mantenimiento/vehiculos/:id/planes`). */
export interface VehiculoPlanAsignado {
  id: string;
  vehiculoId: string;
  planId: string;
  activo: boolean;
  baseKm: number | null;
  baseFecha: string | null;
  plan: { id: string; nombre: string; categoria: CategoriaPlan; activo: boolean; tareas: TareaMantenimiento[] };
}

/** Datos con los que "Registrar service" abre el alta de una OT. */
export interface PrecargaOrden {
  vehiculoId: string;
  vehiculoPlanIds: string[];
  tareas: TareaMantenimiento[];
  km: number | null;
}
