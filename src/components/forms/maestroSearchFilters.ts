import type { Chofer, Cliente, Transportista, Vehiculo } from '@/types/api';

export function filtrarClientesPorQuery(clientes: Cliente[], q: string): Cliente[] {
  const s = q.trim().toLowerCase();
  if (!s) return clientes;
  return clientes.filter((c) => {
    const nombre = (c.nombre ?? '').toLowerCase();
    const cuit = (c.cuit ?? '').replace(/\D/g, '');
    const qDigits = s.replace(/\D/g, '');
    return (
      nombre.includes(s) ||
      (qDigits.length >= 3 && cuit.includes(qDigits)) ||
      (c.cuit && c.cuit.toLowerCase().includes(s))
    );
  });
}

export function filtrarChoferes(choferes: Chofer[], q: string): Chofer[] {
  const s = q.trim().toLowerCase();
  if (!s) return choferes;
  return choferes.filter((c) => {
    const nombre = (c.nombre ?? '').toLowerCase();
    const dni = (c.dni ?? '').replace(/\D/g, '');
    const tel = (c.telefono ?? '').replace(/\D/g, '');
    const qd = s.replace(/\D/g, '');
    return (
      nombre.includes(s) ||
      (qd.length >= 2 && dni.includes(qd)) ||
      (qd.length >= 3 && tel.includes(qd))
    );
  });
}

export function filtrarTransportistas(transportistas: Transportista[], q: string): Transportista[] {
  const s = q.trim().toLowerCase();
  if (!s) return transportistas;
  return transportistas.filter((t) => {
    const nombre = (t.nombre ?? '').toLowerCase();
    const cuit = (t.cuit ?? '').replace(/\D/g, '');
    const qDigits = s.replace(/\D/g, '');
    return (
      nombre.includes(s) ||
      (qDigits.length >= 3 && cuit.includes(qDigits)) ||
      (t.cuit && t.cuit.toLowerCase().includes(s))
    );
  });
}

export function filtrarVehiculos(vehiculos: Vehiculo[], q: string): Vehiculo[] {
  const s = q.trim().toLowerCase();
  if (!s) return vehiculos;
  return vehiculos.filter((v) => {
    const pat = (v.patente ?? '').toLowerCase();
    const marca = (v.marca ?? '').toLowerCase();
    const modelo = (v.modelo ?? '').toLowerCase();
    const tipo = (v.tipo ?? '').toLowerCase();
    return pat.includes(s) || marca.includes(s) || modelo.includes(s) || tipo.includes(s);
  });
}
