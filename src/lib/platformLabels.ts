const facturacion: Record<string, string> = {
  trial: 'En prueba',
  active: 'Al día',
  suspended: 'Suspendido',
  expired: 'Vencido',
};

const modulos: Record<string, string> = {
  viajes: 'Viajes',
  clientes: 'Clientes',
  transportistas: 'Transportes',
  choferes: 'Choferes',
  vehiculos: 'Vehículos',
  facturacion: 'Registro de Facturas',
  'emision-facturas-arca': 'Emisión de facturas (ARCA)',
  'emision-liquido-producto-arca': 'Emisión de líquido producto (ARCA)',
  'cuenta-corriente': 'Cuenta corriente',
  stock: 'Stock',
  combustible: 'Combustible',
  mantenimiento: 'Mantenimiento',
};

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
