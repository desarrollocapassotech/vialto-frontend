import {
  Banknote,
  CalendarClock,
  Droplet,
  FileClock,
  Fuel,
  HandCoins,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Receipt,
  Route,
  TrendingUp,
  Truck,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  canAccessCombustible,
  canAccessCuentaCorriente,
  canAccessEmisionLiquidoProductoArca,
  canAccessFacturacion,
  canAccessMantenimiento,
  canAccessStock,
  canAccessViajes,
  planesMantenimientoHabilitados,
} from "@/lib/tenantModules";
import type { Tenant } from "@/types/api";

/**
 * Catálogo de bloques del dashboard de inicio (`Tenant.dashboardBloques`, lo elige el
 * superadmin en la ficha de la empresa → Dashboard). Espejo de `DASHBOARD_BLOQUES` en
 * `vialto-backend/src/core/tenants/dto/update-tenant.dto.ts`: si se agrega un bloque,
 * sumarlo en los dos lados y dibujarlo en `components/tenant/DashboardBloque.tsx`.
 */

export type DashboardBloqueTipo = "tarjeta" | "pendientes" | "analisis";

/** De dónde salen los datos del bloque; el dashboard pide solo las fuentes que usa. */
export type DashboardFuente =
  | "resumen"
  | "financiero"
  | "combustible"
  | "cuentaCorriente"
  | "mantenimiento"
  | "propia";

type TenantDashboard = Pick<
  Tenant,
  "modules" | "dashboardBloques" | "mantenimientoPlanesHabilitados" | "tipoFlota"
>;

type Requisito = (t: TenantDashboard) => boolean;

const viajes: Requisito = (t) => canAccessViajes(t.modules);
const facturacion: Requisito = (t) =>
  canAccessViajes(t.modules) || canAccessFacturacion(t.modules);
const conTransportistas: Requisito = (t) =>
  canAccessViajes(t.modules) && t.tipoFlota !== "propia";
const cuentaCorriente: Requisito = (t) => canAccessCuentaCorriente(t.modules);
const combustible: Requisito = (t) => canAccessCombustible(t.modules);
const stock: Requisito = (t) => canAccessStock(t.modules);
const mantenimiento: Requisito = (t) =>
  canAccessMantenimiento(t.modules) && planesMantenimientoHabilitados(t);

export type DashboardBloqueDef = {
  id: string;
  label: string;
  /** Tooltip del "?" en la configuración de superadmin. */
  ayuda: string;
  tipo: DashboardBloqueTipo;
  fuente: DashboardFuente;
  /** Módulo que lo alimenta, para mostrarlo en la configuración. */
  modulo: string;
  /** Solo tarjetas: ícono del tema (camión, surtidor, llave…). */
  icono?: LucideIcon;
  /** Solo tarjetas: mensaje amigable cuando el valor es cero. */
  textoCero?: string;
  disponible: Requisito;
  /** Entra en el set por defecto (empresa sin configuración guardada). */
  recomendado?: Requisito;
};

export const DASHBOARD_BLOQUES: readonly DashboardBloqueDef[] = [
  // ── Tarjetas ──────────────────────────────────────────────────────────
  {
    id: "facturado",
    icono: Receipt,
    label: "Facturado",
    ayuda: "Total facturado a clientes, en pesos y dólares.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Facturación",
    disponible: facturacion,
    recomendado: facturacion,
  },
  {
    id: "cobrado",
    icono: Wallet,
    label: "Cobrado",
    ayuda: "Lo cobrado a clientes en el período elegido.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Facturación",
    disponible: facturacion,
    recomendado: facturacion,
  },
  {
    id: "sin-facturar",
    icono: FileClock,
    textoCero: "Todo facturado",
    label: "Sin facturar",
    ayuda: "Monto de los viajes del período que todavía no tienen factura.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Viajes",
    disponible: viajes,
    recomendado: viajes,
  },
  {
    id: "a-pagar-transportistas",
    icono: Truck,
    textoCero: "Nada pendiente",
    label: "A pagar a transportistas",
    ayuda: "Lo que se les debe a los transportistas por los viajes del período.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Viajes",
    disponible: conTransportistas,
    recomendado: conTransportistas,
  },
  {
    id: "margen",
    icono: TrendingUp,
    label: "Margen",
    ayuda: "Cobrado menos lo pagado a transportistas en el período.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Viajes",
    disponible: conTransportistas,
  },
  {
    id: "viajes-en-curso",
    icono: Route,
    textoCero: "Ningún viaje en ruta",
    label: "Viajes en curso",
    ayuda: "Viajes en curso en el período.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Viajes",
    disponible: viajes,
    recomendado: viajes,
  },
  {
    id: "viajes-finalizados",
    icono: PackageCheck,
    label: "Viajes finalizados",
    ayuda: "Viajes que terminaron en el período.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Viajes",
    disponible: viajes,
  },
  {
    id: "por-cobrar",
    icono: HandCoins,
    textoCero: "Sin saldos a cobrar",
    label: "Por cobrar",
    ayuda: "Suma de los saldos de los clientes en Cuenta corriente.",
    tipo: "tarjeta",
    fuente: "cuentaCorriente",
    modulo: "Cuenta corriente",
    disponible: cuentaCorriente,
    recomendado: cuentaCorriente,
  },
  {
    id: "por-pagar",
    icono: Banknote,
    textoCero: "Sin saldos a pagar",
    label: "Por pagar",
    ayuda: "Suma de los saldos de los proveedores en Cuenta corriente.",
    tipo: "tarjeta",
    fuente: "cuentaCorriente",
    modulo: "Cuenta corriente",
    disponible: cuentaCorriente,
    recomendado: cuentaCorriente,
  },
  {
    id: "combustible-gasto",
    icono: Fuel,
    label: "Gasto en combustible",
    ayuda: "Total de las cargas de combustible del período.",
    tipo: "tarjeta",
    fuente: "combustible",
    modulo: "Combustible",
    disponible: combustible,
    recomendado: combustible,
  },
  {
    id: "combustible-precio-litro",
    icono: Droplet,
    label: "Precio promedio por litro",
    ayuda: "Precio promedio pagado por litro en el período.",
    tipo: "tarjeta",
    fuente: "combustible",
    modulo: "Combustible",
    disponible: combustible,
  },
  {
    id: "stock-ingresos",
    icono: PackagePlus,
    label: "Ingresos de stock",
    ayuda: "Ingresos de mercadería registrados en el período.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Stock",
    disponible: stock,
    recomendado: stock,
  },
  {
    id: "stock-egresos",
    icono: PackageMinus,
    label: "Egresos de stock",
    ayuda: "Egresos/despachos registrados en el período.",
    tipo: "tarjeta",
    fuente: "resumen",
    modulo: "Stock",
    disponible: stock,
    recomendado: stock,
  },
  {
    id: "mantenimiento-vencidos",
    icono: Wrench,
    textoCero: "Todo al día",
    label: "Mantenimiento vencido",
    ayuda: "Planes que ya pasaron su km o su fecha (a hoy, no depende del período).",
    tipo: "tarjeta",
    fuente: "mantenimiento",
    modulo: "Mantenimiento",
    disponible: mantenimiento,
    recomendado: mantenimiento,
  },
  {
    id: "mantenimiento-proximos",
    icono: CalendarClock,
    textoCero: "Nada por vencer",
    label: "Mantenimiento por vencer",
    ayuda: "Planes dentro del aviso anticipado (a hoy, no depende del período).",
    tipo: "tarjeta",
    fuente: "mantenimiento",
    modulo: "Mantenimiento",
    disponible: mantenimiento,
  },
  // ── Pendientes ────────────────────────────────────────────────────────
  {
    id: "pendientes-facturas-vencidas",
    label: "Facturas vencidas sin cobrar",
    ayuda: "Lista de facturas vencidas con saldo pendiente.",
    tipo: "pendientes",
    fuente: "resumen",
    modulo: "Facturación",
    disponible: facturacion,
    recomendado: facturacion,
  },
  {
    id: "pendientes-viajes-sin-facturar",
    label: "Viajes finalizados sin facturar",
    ayuda: "Lista de viajes terminados que todavía no tienen factura.",
    tipo: "pendientes",
    fuente: "resumen",
    modulo: "Viajes",
    disponible: viajes,
    recomendado: viajes,
  },
  {
    id: "pendientes-viajes-sin-liquidar",
    label: "Viajes sin liquidar",
    ayuda: "Lista de viajes terminados que todavía no se liquidaron al transportista.",
    tipo: "pendientes",
    fuente: "financiero",
    modulo: "Viajes",
    disponible: conTransportistas,
  },
  {
    id: "pendientes-cuenta-corriente",
    label: "Vencimientos de cuenta corriente",
    ayuda: "Comprobantes vencidos y por vencer, a cobrar y a pagar.",
    tipo: "pendientes",
    fuente: "cuentaCorriente",
    modulo: "Cuenta corriente",
    disponible: cuentaCorriente,
    recomendado: cuentaCorriente,
  },
  {
    id: "pendientes-mantenimiento",
    label: "Próximos vencimientos de mantenimiento",
    ayuda: "Los cinco planes vencidos o más próximos a vencer.",
    tipo: "pendientes",
    fuente: "mantenimiento",
    modulo: "Mantenimiento",
    disponible: mantenimiento,
    recomendado: mantenimiento,
  },
  {
    id: "pendientes-combustible",
    label: "Alertas de combustible",
    ayuda: "Cargas sospechosas y cargas de choferes que no se pudieron registrar.",
    tipo: "pendientes",
    fuente: "combustible",
    modulo: "Combustible",
    disponible: combustible,
    recomendado: combustible,
  },
  {
    id: "pendientes-margen-bajo",
    label: "Viajes con margen bajo",
    ayuda: "Viajes del período con margen bajo o negativo.",
    tipo: "pendientes",
    fuente: "financiero",
    modulo: "Viajes",
    disponible: conTransportistas,
  },
  // ── Análisis ──────────────────────────────────────────────────────────
  {
    id: "analisis-margen",
    label: "Margen por cliente, transportista y ruta",
    ayuda: "Facturado y margen del período, con tablas por cliente, transportista, ruta y tipo de carga.",
    tipo: "analisis",
    fuente: "financiero",
    modulo: "Viajes",
    disponible: viajes,
  },
  {
    id: "analisis-viajes",
    label: "Viajes por etapa",
    ayuda: "Cantidad de viajes por etapa, liquidados, y listas de sin facturar y sin liquidar.",
    tipo: "analisis",
    fuente: "financiero",
    modulo: "Viajes",
    disponible: viajes,
  },
  {
    id: "analisis-facturacion",
    label: "Facturación por tipo y cliente",
    ayuda: "Facturas por tipo de comprobante, facturado vs. cobrado y ranking de clientes.",
    tipo: "analisis",
    fuente: "financiero",
    modulo: "Facturación",
    disponible: facturacion,
  },
  {
    id: "analisis-liquidaciones",
    label: "Liquidaciones a transportistas",
    ayuda: "Acordado, pagado y pendiente por transportista, y totales de los CVLP.",
    tipo: "analisis",
    fuente: "financiero",
    modulo: "Líquido Producto ARCA",
    disponible: (t) =>
      canAccessViajes(t.modules) &&
      canAccessEmisionLiquidoProductoArca(t.modules),
  },
  {
    id: "analisis-cuenta-corriente",
    label: "Tablero de cuenta corriente",
    ayuda: "Por cobrar y por pagar con todos los vencidos, próximos y sin vencimiento, y los PDF de pendientes.",
    tipo: "analisis",
    fuente: "propia",
    modulo: "Cuenta corriente",
    disponible: cuentaCorriente,
  },
  {
    id: "analisis-combustible",
    label: "Resumen de combustible",
    ayuda: "Cargas, costo por km y por litro, km recorridos y la evolución del precio.",
    tipo: "analisis",
    fuente: "combustible",
    modulo: "Combustible",
    disponible: combustible,
  },
  {
    id: "analisis-combustible-vehiculos",
    label: "Combustible por vehículo",
    ayuda: "Ranking de consumo y costo por vehículo.",
    tipo: "analisis",
    fuente: "combustible",
    modulo: "Combustible",
    disponible: combustible,
  },
  {
    id: "analisis-combustible-choferes",
    label: "Combustible por chofer",
    ayuda: "Ranking de consumo y costo por chofer.",
    tipo: "analisis",
    fuente: "combustible",
    modulo: "Combustible",
    disponible: combustible,
  },
  {
    id: "analisis-combustible-distribucion",
    label: "Combustible por estación y forma de pago",
    ayuda: "Cómo se reparte el gasto entre estaciones y formas de pago.",
    tipo: "analisis",
    fuente: "combustible",
    modulo: "Combustible",
    disponible: combustible,
  },
  {
    id: "analisis-combustible-viajes",
    label: "Combustible vs. viajes",
    ayuda: "Cruce de las cargas con los viajes del período.",
    tipo: "analisis",
    fuente: "combustible",
    modulo: "Combustible",
    disponible: (t) => canAccessCombustible(t.modules) && canAccessViajes(t.modules),
  },
];

const POR_ID = new Map(DASHBOARD_BLOQUES.map((b) => [b.id, b]));

export function bloqueDashboard(id: string): DashboardBloqueDef | undefined {
  return POR_ID.get(id);
}

export const TIPO_BLOQUE_LABEL: Record<DashboardBloqueTipo, string> = {
  tarjeta: "Tarjetas",
  pendientes: "Pendientes",
  analisis: "Análisis",
};

/** Bloques que la empresa puede usar con sus módulos, en el orden del catálogo. */
export function bloquesDisponibles(tenant: TenantDashboard): DashboardBloqueDef[] {
  return DASHBOARD_BLOQUES.filter((b) => b.disponible(tenant));
}

/** Set por defecto: tarjetas y pendientes recomendados para sus módulos. */
export function bloquesRecomendados(tenant: TenantDashboard): string[] {
  return DASHBOARD_BLOQUES.filter(
    (b) => b.disponible(tenant) && b.recomendado?.(tenant),
  ).map((b) => b.id);
}

/** Los guardados que siguen disponibles, en su orden (sin validar contra el set por defecto). */
export function bloquesGuardadosDisponibles(tenant: TenantDashboard): string[] {
  return (tenant.dashboardBloques ?? []).filter((id) => {
    const b = POR_ID.get(id);
    return b != null && b.disponible(tenant);
  });
}

/**
 * Lo que ve la empresa, en orden. Sin configuración guardada (o si ninguno de los
 * guardados sigue disponible porque se dieron de baja módulos) va el set recomendado.
 */
export function bloquesEfectivos(tenant: TenantDashboard): string[] {
  const guardados = bloquesGuardadosDisponibles(tenant);
  return guardados.length > 0 ? guardados : bloquesRecomendados(tenant);
}

/** true si la empresa no tiene configuración propia (ve el set recomendado). */
export function usaBloquesRecomendados(tenant: TenantDashboard): boolean {
  return bloquesGuardadosDisponibles(tenant).length === 0;
}

/** Tarjetas con montos en ARS y USD: en mobile van a todo el ancho (no entran de a dos). */
const TARJETAS_DOS_MONEDAS = new Set([
  "facturado",
  "cobrado",
  "sin-facturar",
  "a-pagar-transportistas",
  "por-cobrar",
  "por-pagar",
]);

export function tarjetaDosMonedas(id: string): boolean {
  return TARJETAS_DOS_MONEDAS.has(id);
}

/**
 * Tarjetas por fila en desktop para `n` tarjetas seguidas: hasta 4 por fila,
 * repartidas parejo (5 → 3+2, 7 → 4+3, 9 → 3+3+3) para no dejar una sola en la última.
 */
export function tarjetasPorFila(n: number): number {
  if (n <= 4) return Math.max(n, 1);
  return Math.ceil(n / Math.ceil(n / 4));
}

/** Bloques que ocupan todo el ancho (tablas anchas); el resto de los no-tarjeta va de a dos. */
export function bloqueAnchoCompleto(id: string): boolean {
  return POR_ID.get(id)?.tipo === "analisis" || id === "pendientes-combustible";
}

export function fuentesDeBloques(ids: readonly string[]): Set<DashboardFuente> {
  const out = new Set<DashboardFuente>();
  for (const id of ids) {
    const b = POR_ID.get(id);
    if (b) out.add(b.fuente);
  }
  return out;
}
