import { labelModulo } from '@/lib/platformLabels';

export type TenantModuleCard = {
  code: string;
  title: string;
  description: string;
  route?: string;
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  viajes: 'Planificación y seguimiento operativo de viajes.',
  facturacion: 'Gestión de emisión y control de cobranzas.',
  'cuenta-corriente': 'Seguimiento de saldo y movimientos por cliente.',
  stock: 'Control de inventario y movimientos de mercadería.',
  combustible: 'Registro de cargas y control de consumo.',
  mantenimiento: 'Servicios de flota y alertas operativas.',
  remitos: 'Emisión y seguimiento de remitos digitales.',
  turnos: 'Asignación y administración de turnos de choferes.',
  reportes: 'Indicadores y vistas analíticas por módulo.',
};

const MODULE_ROUTES: Record<string, string> = {
  viajes: '/viajes',
  facturacion: '/facturacion',
};

export function toTenantModuleCards(modules: string[]): TenantModuleCard[] {
  const unique = Array.from(new Set(modules.map((m) => m.toLowerCase())));
  return unique.map((code) => ({
    code,
    title: labelModulo(code),
    description:
      MODULE_DESCRIPTIONS[code] ?? 'Módulo habilitado para esta empresa.',
    route: MODULE_ROUTES[code],
  }));
}

export function canAccessViajes(modules: string[]): boolean {
  return modules.some((m) => m.toLowerCase() === 'viajes');
}

export function canAccessFacturacion(modules: string[]): boolean {
  return modules.some((m) => m.toLowerCase() === 'facturacion');
}
