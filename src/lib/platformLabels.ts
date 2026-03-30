const planes: Record<string, string> = {
  basico: 'Básico',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const facturacion: Record<string, string> = {
  trial: 'En prueba',
  active: 'Al día',
  suspended: 'Suspendido',
};

const modulos: Record<string, string> = {
  viajes: 'Viajes',
  facturacion: 'Facturación',
  'cuenta-corriente': 'Cuenta corriente',
  stock: 'Stock',
  combustible: 'Combustible',
  mantenimiento: 'Mantenimiento',
  remitos: 'Remitos',
  turnos: 'Turnos',
  reportes: 'Reportes',
};

export function labelPlan(plan: string): string {
  const p = plan.toLowerCase();
  return planes[p] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function labelBillingStatus(status: string): string {
  const s = status.toLowerCase();
  return facturacion[s] ?? status;
}

export function labelModulo(code: string): string {
  const c: string = code.toLowerCase();
  if (modulos[c]) return modulos[c];
  return code
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
