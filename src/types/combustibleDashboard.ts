export type CombustibleMetricSimple = {
  current: number;
  previous: number;
  changePct: number | null;
};

export type CombustibleDistribucionItem = {
  clave: string;
  litros: number;
  monto: number;
  cantidad: number;
  precioPromedio: number;
};

export type CombustiblePorVehiculoItem = {
  vehiculoId: string;
  patente: string;
  tipo: string;
  litros: number;
  monto: number;
  cantidad: number;
  kmRecorridos: number | null;
  costoPorKm: number | null;
  litrosPor100Km: number | null;
  esOutlier: boolean;
  semaforo: "verde" | "amarillo" | "rojo";
};

export type CombustiblePorChoferItem = {
  choferId: string | null;
  nombre: string;
  litros: number;
  monto: number;
  cantidad: number;
};

export type CombustibleAlerta = {
  cargaId: string;
  vehiculoId: string | null;
  patente: string;
  choferNombre: string | null;
  fecha: string;
  motivoSospecha: string;
  litros: number;
  importe: number;
  precioPorLitro: number;
};

/** COMB-07-T5: carga que el chofer intentó sincronizar offline y el backend rechazó. */
export type CombustibleErrorSincronizacion = {
  id: string;
  mensaje: string;
  fechaCarga: string | null;
  reportadoEn: string;
  choferNombre: string;
  patente: string;
  litros: number | null;
  importe: number | null;
  estacion: string | null;
};

export type CombustibleEvolucionPrecioPunto = {
  etiqueta: string;
  desde: string;
  hasta: string;
  precioPromedio: number;
};

export type CombustibleEvolucionCostoPorKmPunto = {
  etiqueta: string;
  desde: string;
  hasta: string;
  costoPorKm: number;
};

export type CombustibleViajesCruceItem = {
  vehiculoId: string;
  patente: string;
  litrosPeriodo: number;
  kmFacturadosPeriodo: number | null;
  litrosPor100KmFacturado: number | null;
};

export type CombustibleUltimaCarga = {
  id: string;
  fecha: string;
  litros: number;
  importe: number;
  km: number;
  estacion: string;
  formaPago: string | null;
  vehiculo: { patente: string } | null;
  chofer: { nombre: string } | null;
};

export type CombustibleDashboardResponse = {
  totalCargas: number;
  totalLitros: number;
  totalImporte: number;
  precioPorLitro: number;
  litrosPorCarga: number;
  costoTotalPeriodo: CombustibleMetricSimple | null;
  distribucionEstaciones: CombustibleDistribucionItem[];
  distribucionFormaPago: CombustibleDistribucionItem[];
  porVehiculo: CombustiblePorVehiculoItem[];
  porChofer: CombustiblePorChoferItem[];
  alertas: CombustibleAlerta[];
  erroresSincronizacion: CombustibleErrorSincronizacion[];
  evolucionPrecio: CombustibleEvolucionPrecioPunto[];
  evolucionCostoPorKm: CombustibleEvolucionCostoPorKmPunto[];
  viajesCruce: CombustibleViajesCruceItem[] | null;
  ultimasCargas: CombustibleUltimaCarga[];
};
