export type FinancieroMoney = { ARS: number; USD: number };

export type FinancieroMargenPorEntidad = {
  id: string;
  nombre: string;
  cantViajes: number;
  facturado: FinancieroMoney;
  margen: FinancieroMoney;
  margenPct: number | null;
};

export type FinancieroMargenAlerta = {
  viajeId: string;
  numero: string;
  clienteNombre: string;
  transportistaNombre: string | null;
  facturado: number;
  moneda: 'ARS' | 'USD';
  margen: number;
  margenPct: number | null;
};

export type FinancieroMargenPorRuta = {
  clave: string;
  cantViajes: number;
  margenPctPromedio: number | null;
};

export type FinancieroDashboardResponse = {
  periodo: { from: string; to: string };
  margen?: {
    resumen: {
      facturado: FinancieroMoney;
      margen: FinancieroMoney;
      cantViajesConMargenAuto: number;
      cantViajesSinDatos: number;
      margenPctPromedio: number | null;
    };
    porCliente: FinancieroMargenPorEntidad[];
    porTransportista: FinancieroMargenPorEntidad[];
    porRuta: FinancieroMargenPorRuta[];
    porTipoCarga: FinancieroMargenPorRuta[];
    alertas: FinancieroMargenAlerta[];
  };
  viajesFunnel?: {
    porEtapa: Array<{ etapa: string; cantidad: number }>;
    liquidados: {
      cantidad: number;
      montoTotal: FinancieroMoney;
    };
    sinLiquidar: {
      cantidad: number;
      montoPendiente: FinancieroMoney;
      items: Array<{ id: string; numero: string; transportistaNombre: string | null }>;
    };
    sinFacturar: {
      cantidad: number;
      montoTotal: FinancieroMoney;
      items: Array<{ id: string; numero: string; clienteNombre: string }>;
    };
  };
  liquidaciones?: {
    aPagarPorTransportista: Array<{
      transportistaId: string;
      nombre: string;
      acordado: FinancieroMoney;
      pagado: FinancieroMoney;
      pendiente: FinancieroMoney;
      cantViajes: number;
    }>;
    rankingPorLiquidado: Array<{
      transportistaId: string;
      nombre: string;
      liquido: number;
      cantLiquidaciones: number;
    }>;
    cvlpPorPeriodo: Array<{
      periodo: string;
      cantLiquidaciones: number;
      bruto: number;
      comision: number;
      gastosAdmin: number;
      liquido: number;
    }>;
  };
  facturacion?: {
    porTipoComprobante: {
      A: { cantidad: number; monto: number };
      B: { cantidad: number; monto: number };
      sinArca: { cantidad: number; monto: number };
    };
    rankingClientes: Array<{
      clienteId: string;
      nombre: string;
      facturado: FinancieroMoney;
      cobrado: FinancieroMoney;
      pendienteCobro: FinancieroMoney;
      cantFacturas: number;
    }>;
    pendientesEmitir: {
      cantidad: number;
      montoTotal: FinancieroMoney;
      items: Array<{ id: string; numero: string; clienteNombre: string }>;
    };
    facturadoVsCobrado: {
      facturado: FinancieroMoney;
      cobrado: FinancieroMoney;
      pendienteCobro: FinancieroMoney;
    };
  };
};
