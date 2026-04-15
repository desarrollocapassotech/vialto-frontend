import { useAuth } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api';

export type DashboardMetricCard = {
  key: string;
  title: string;
  value: string;
  hint?: string;
};

type ViajeStats = Record<string, number>;

type FacturaLike = {
  id: string;
  estado: string;
  viajeId: string | null;
  fechaEmision: string;
};

type RemitoLike = {
  id: string;
  estado: string;
};

type MovimientoStockLike = {
  id: string;
  tipo: string;
  fecha: string;
};

type MovimientoCcLike = {
  id: string;
  tipo: string;
  fecha: string;
};

type IntervencionLike = {
  id: string;
  fecha: string;
};

type CargaCombustibleListResponse = {
  cargas: Array<{
    id: string;
    litros: number;
    importe: number;
    fecha: string;
  }>;
  count: number;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfCurrentFortnight(date: Date) {
  const day = date.getDate();
  return day <= 15
    ? new Date(date.getFullYear(), date.getMonth(), 1)
    : new Date(date.getFullYear(), date.getMonth(), 16);
}

function isOnOrAfter(value: string, threshold: Date) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed >= threshold;
}

function formatMoney(value: number) {
  return `$ ${value.toLocaleString('es-AR')}`;
}

export function useTenantDashboardMetrics(modules: string[]) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [cards, setCards] = useState<DashboardMetricCard[]>([]);
  const [loading, setLoading] = useState(false);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const modulesKey = Array.from(new Set(modules.map((m) => m.toLowerCase())))
    .sort()
    .join('|');
  const normalizedModules = modulesKey ? modulesKey.split('|') : [];

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const has = (code: string) => normalizedModules.includes(code);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const fortnightStart = startOfCurrentFortnight(now);
    let cancelled = false;

    async function safeGet<T>(path: string): Promise<T | null> {
      try {
        return await apiJson<T>(path, () => getTokenRef.current());
      } catch {
        return null;
      }
    }

    setLoading(true);

    (async () => {
      const [
        viajeStats,
        facturas,
        remitos,
        productos,
        movimientosStock,
        movimientosCc,
        intervenciones,
        cargas,
      ] = await Promise.all([
        has('viajes') ? safeGet<ViajeStats>('/api/viajes/stats') : Promise.resolve(null),
        has('facturacion')
          ? safeGet<FacturaLike[]>('/api/facturacion/facturas')
          : Promise.resolve(null),
        has('remitos') ? safeGet<RemitoLike[]>('/api/remitos') : Promise.resolve(null),
        has('stock') ? safeGet<Array<{ id: string }>>('/api/stock/productos') : Promise.resolve(null),
        has('stock')
          ? safeGet<MovimientoStockLike[]>('/api/stock/movimientos')
          : Promise.resolve(null),
        has('cuenta-corriente')
          ? safeGet<MovimientoCcLike[]>('/api/cuenta-corriente/movimientos')
          : Promise.resolve(null),
        has('mantenimiento')
          ? safeGet<IntervencionLike[]>('/api/mantenimiento/intervenciones')
          : Promise.resolve(null),
        has('combustible')
          ? safeGet<CargaCombustibleListResponse>('/api/combustible')
          : Promise.resolve(null),
      ]);

      if (cancelled) return;

      const next: DashboardMetricCard[] = [];

      if (viajeStats) {
        const enCurso = viajeStats['en_curso'] ?? 0;
        const porFacturar = viajeStats['finalizado_sin_facturar'] ?? 0;

        let viajesFacturadosMes = 0;
        let viajesFacturadosQuincena = 0;

        if (facturas) {
          const facturasConViaje = facturas.filter((f) => Boolean(f.viajeId));
          viajesFacturadosMes = facturasConViaje.filter((f) =>
            isOnOrAfter(f.fechaEmision, monthStart),
          ).length;
          viajesFacturadosQuincena = facturasConViaje.filter((f) =>
            isOnOrAfter(f.fechaEmision, fortnightStart),
          ).length;
        }

        next.push(
          {
            key: 'viajes-en-curso',
            title: 'Viajes en curso',
            value: String(enCurso),
          },
          {
            key: 'viajes-por-facturar',
            title: 'Viajes por facturar',
            value: String(porFacturar),
            hint: 'Finalizados sin factura asociada',
          },
          {
            key: 'viajes-facturados',
            title: 'Viajes facturados',
            value: String(viajesFacturadosMes),
            hint: `Mes: ${viajesFacturadosMes} · Quincena: ${viajesFacturadosQuincena}`,
          },
        );
      }

      if (facturas) {
        const pendientes = facturas.filter(
          (f) => (f.estado ?? '').toLowerCase() === 'pendiente',
        ).length;
        const vencidas = facturas.filter(
          (f) => (f.estado ?? '').toLowerCase() === 'vencida',
        ).length;
        const cobradasMes = facturas.filter(
          (f) =>
            (f.estado ?? '').toLowerCase() === 'cobrada' &&
            isOnOrAfter(f.fechaEmision, monthStart),
        ).length;

        next.push(
          {
            key: 'facturas-pendientes',
            title: 'Facturas pendientes',
            value: String(pendientes),
          },
          {
            key: 'facturas-cobradas-mes',
            title: 'Facturas cobradas (mes)',
            value: String(cobradasMes),
            hint: `Vencidas: ${vencidas}`,
          },
        );
      }

      if (movimientosCc) {
        const delMes = movimientosCc.filter((m) => isOnOrAfter(m.fecha, monthStart));
        const cargosMes = delMes.filter((m) => (m.tipo ?? '').toLowerCase() === 'cargo').length;
        const pagosMes = delMes.filter((m) => (m.tipo ?? '').toLowerCase() === 'pago').length;
        next.push({
          key: 'cc-movimientos',
          title: 'Cuenta corriente (mes)',
          value: String(delMes.length),
          hint: `Cargos: ${cargosMes} · Pagos: ${pagosMes}`,
        });
      }

      if (productos && movimientosStock) {
        const delMes = movimientosStock.filter((m) => isOnOrAfter(m.fecha, monthStart));
        const ingresos = delMes.filter((m) => (m.tipo ?? '').toLowerCase() === 'ingreso').length;
        const egresos = delMes.filter((m) => (m.tipo ?? '').toLowerCase() === 'egreso').length;
        next.push(
          {
            key: 'stock-productos',
            title: 'Productos activos',
            value: String(productos.length),
          },
          {
            key: 'stock-movimientos',
            title: 'Movimientos de stock (mes)',
            value: String(delMes.length),
            hint: `Ingresos: ${ingresos} · Egresos: ${egresos}`,
          },
        );
      }

      if (cargas) {
        const delMes = cargas.cargas.filter((c) => isOnOrAfter(c.fecha, monthStart));
        const litrosMes = delMes.reduce((acc, c) => acc + (c.litros ?? 0), 0);
        const importeMes = delMes.reduce((acc, c) => acc + (c.importe ?? 0), 0);
        next.push(
          {
            key: 'combustible-cargas',
            title: 'Cargas de combustible (mes)',
            value: String(delMes.length),
            hint: `Litros: ${litrosMes.toLocaleString('es-AR')}`,
          },
          {
            key: 'combustible-gasto',
            title: 'Gasto en combustible (mes)',
            value: formatMoney(importeMes),
          },
        );
      }

      if (intervenciones) {
        const delMes = intervenciones.filter((i) => isOnOrAfter(i.fecha, monthStart));
        next.push({
          key: 'mantenimiento-intervenciones',
          title: 'Intervenciones (mes)',
          value: String(delMes.length),
        });
      }

      if (remitos) {
        const emitidos = remitos.filter(
          (r) => (r.estado ?? '').toLowerCase() === 'emitido',
        ).length;
        const firmados = remitos.filter(
          (r) => (r.estado ?? '').toLowerCase() === 'firmado',
        ).length;
        const facturados = remitos.filter(
          (r) => (r.estado ?? '').toLowerCase() === 'facturado',
        ).length;
        next.push({
          key: 'remitos-estado',
          title: 'Remitos',
          value: String(remitos.length),
          hint: `Emitidos: ${emitidos} · Firmados: ${firmados} · Facturados: ${facturados}`,
        });
      }

      if (has('turnos')) {
        next.push({
          key: 'turnos-estado',
          title: 'Turnos',
          value: 'Fase 7',
          hint: 'Módulo en implementación',
        });
      }

      if (has('reportes')) {
        next.push({
          key: 'reportes-estado',
          title: 'Reportes',
          value: 'Activo',
          hint: 'Resumen operativo habilitado',
        });
      }

      setCards(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, modulesKey]);

  return { cards, loading };
}
