export type DashboardPeriodKind = 'week' | 'month' | '3months' | 'custom';

export type MetricCompare = {
  current: number;
  previous: number;
  changePct: number | null;
  sentiment: 'positive' | 'negative' | 'neutral';
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
    facturado: MetricCompare;
    cobrado: MetricCompare;
    aPagarTransportistas: MetricCompare;
    mostrarDiferenciaNeta: boolean;
    diferenciaNetaEstimada: number;
    diferenciaNetaCompare: MetricCompare;
  };
  alertas?: {
    facturasVencidas: { cantidad: number; montoTotal: number };
    viajesSinFactura: { cantidad: number; montoTotal: number };
  } | null;
  viajes?: {
    enCurso: MetricCompare;
    completados: MetricCompare;
    sinFacturarMonto: number;
  };
};
