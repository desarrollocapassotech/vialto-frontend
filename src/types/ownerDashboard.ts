export type DashboardPeriodKind = 'week' | 'month' | '3months' | 'custom';

export type MetricCompare = {
  current: number;
  previous: number;
  changePct: number | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  /** Totales por moneda del período actual (sin conversión). */
  currencies?: { ARS: number; USD: number };
};

export type OwnerDashboardResponse = {
  period: {
    kind: DashboardPeriodKind;
    start: string;
    end: string;
    prevStart: string;
    prevEnd: string;
  };
  financiero?: {
    sinFacturarPeriodo: MetricCompare;
    facturado: MetricCompare;
    cobrado: MetricCompare;
    aPagarTransportistas: MetricCompare;
    margen: MetricCompare;
    mostrarDiferenciaNeta: boolean;
    diferenciaNetaEstimada: number;
    diferenciaNetaCompare: MetricCompare;
  };
  alertas?: {
    facturasVencidas: {
      cantidad: number;
      montoTotal: number;
      /** Ausente en respuestas cacheadas o API antigua; el UI usa `montoTotal` como respaldo. */
      montosPorMoneda?: { ARS: number; USD: number };
      items?: Array<{ id: string; numero: string }>;
    };
    viajesSinFactura: {
      cantidad: number;
      montoTotal: number;
      montosPorMoneda?: { ARS: number; USD: number };
      items?: Array<{
        id: string;
        numero: string;
        clienteNombre?: string;
        fecha?: string | null;
        origen?: string | null;
        destino?: string | null;
      }>;
    };
    /** Cargas de combustible marcadas `sospechoso` (snapshot actual, no filtrado por período). */
    cargasSospechosas?: {
      cantidad: number;
      montoTotal: number;
    };
    /** Viajes del período con margen bajo o negativo. `montoTotal` solo suma el margen negativo en ARS. */
    margenBajo?: {
      cantidad: number;
      montoTotal: number;
    };
  } | null;
  viajes?: {
    enCurso: MetricCompare;
    completados: MetricCompare;
    sinFacturarMonto: number;
    sinFacturar: number;
    sinCobrar: number;
    cobrados: number;
  };
  stock?: {
    totalProductos: number;
    totalClientes: number;
    ingresosHoy: number;
    egresosHoy: number;
  };
};
