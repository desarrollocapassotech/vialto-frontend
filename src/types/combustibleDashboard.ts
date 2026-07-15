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

export type CombustibleProyeccionMesActual = {
  gastoAcumulado: number;
  diasTranscurridos: number;
  diasEnMes: number;
  proyeccionTotal: number;
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
  vehiculoId: string;
  patente: string;
  fecha: string;
  tipo: "consumo_alto" | "recarga_rapida";
  detalle: string;
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

export type CombustibleSemaforoResumen = {
  verde: number;
  amarillo: number;
  rojo: number;
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
  proyeccionMesActual: CombustibleProyeccionMesActual;
  distribucionEstaciones: CombustibleDistribucionItem[];
  distribucionFormaPago: CombustibleDistribucionItem[];
  porVehiculo: CombustiblePorVehiculoItem[];
  porChofer: CombustiblePorChoferItem[];
  alertas: CombustibleAlerta[];
  evolucionPrecio: CombustibleEvolucionPrecioPunto[];
  evolucionCostoPorKm: CombustibleEvolucionCostoPorKmPunto[];
  semaforoResumen: CombustibleSemaforoResumen;
  viajesCruce: CombustibleViajesCruceItem[] | null;
  ultimasCargas: CombustibleUltimaCarga[];
};
