import type { MovimientoStock, Producto, StockItem, StockOperacion } from '@/types/api';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';

export interface ExcelColDef<T> {
  id: string;
  label: string;
  getValue: (row: T) => string | number;
  required?: boolean;
}

export async function generarExcel<T>(
  cols: ExcelColDef<T>[],
  rows: T[],
  filename: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const headers = cols.map((c) => c.label);
  const data = rows.map((row) => cols.map((c) => c.getValue(row)));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function presentacionColId(nombre: string): string {
  return `pres_${nombre.trim().toLowerCase().replace(/\s+/g, '_')}`;
}

type PresentacionLike = {
  nombre?: string | null;
  presentacion?: { nombre?: string | null } | null;
} | null | undefined;

function getPresentacionNombre(presentacion: PresentacionLike): string {
  return (
    presentacion?.presentacion?.nombre?.trim() ??
    presentacion?.nombre?.trim() ??
    ''
  );
}

function presentacionNombreFromMovimiento(m: MovimientoStock): string {
  return getPresentacionNombre(m.presentacion);
}

function presentacionNombreFromStockItem(i: StockItem, productos: Producto[] = []): string {
  const directo = getPresentacionNombre(i.presentacion);
  if (directo) return directo;

  const producto = productos.find((p) => p.id === i.productoId);
  const productoPresentacion = producto?.productoPresentaciones?.find(
    (pp) => pp.id === i.presentacionId || pp.presentacionId === i.presentacionId,
  );
  return productoPresentacion?.presentacion?.nombre?.trim() ?? '';
}

/** Todas las presentaciones de los productos involucrados, sin límite de cantidad. */
export function collectPresentacionNombres(
  items: MovimientoStock[],
  productos: Producto[],
): string[] {
  const productIds = new Set(items.map((m) => m.productoId));
  const seen = new Set<string>();
  const names: string[] = [];

  for (const producto of productos) {
    if (!productIds.has(producto.id)) continue;
    for (const pp of producto.productoPresentaciones ?? []) {
      const nombre = pp.presentacion?.nombre?.trim();
      if (!nombre || seen.has(nombre)) continue;
      seen.add(nombre);
      names.push(nombre);
    }
  }

  for (const m of items) {
    const nombre = presentacionNombreFromMovimiento(m);
    if (!nombre || seen.has(nombre)) continue;
    seen.add(nombre);
    names.push(nombre);
  }

  return names;
}

function collectPresentacionNombresFromStockItems(
  items: StockItem[],
  productos: Producto[] = [],
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const productIds = new Set(items.map((item) => item.productoId));

  for (const producto of productos) {
    if (!productIds.has(producto.id)) continue;
    for (const pp of producto.productoPresentaciones ?? []) {
      const nombre = pp.presentacion?.nombre?.trim();
      if (!nombre || seen.has(nombre)) continue;
      seen.add(nombre);
      names.push(nombre);
    }
  }

  for (const item of items) {
    const nombre = presentacionNombreFromStockItem(item, productos);
    if (!nombre || seen.has(nombre)) continue;
    seen.add(nombre);
    names.push(nombre);
  }
  return names;
}

function inferUnidad1(items: MovimientoStock[]): string {
  return items.find((m) => m.producto?.unidad1Nombre)?.producto?.unidad1Nombre ?? 'Cantidad 1';
}

function inferUnidad2(items: MovimientoStock[]): string | null {
  const nombre = items.find((m) => m.producto?.unidad2Nombre != null)?.producto?.unidad2Nombre;
  return nombre ?? null;
}

function inferUnidad1Stock(items: StockItem[]): string {
  return items.find((i) => i.producto?.unidad1Nombre)?.producto?.unidad1Nombre ?? 'Cantidad 1';
}

function inferUnidad2Stock(items: StockItem[]): string | null {
  const nombre = items.find((i) => i.producto?.unidad2Nombre != null)?.producto?.unidad2Nombre;
  return nombre ?? null;
}

function presentacionCantidadCols(
  nombres: string[],
  getNombre: (row: MovimientoStock) => string,
  getCantidad: (row: MovimientoStock) => number,
): ExcelColDef<MovimientoStock>[] {
  return nombres.map((nombre) => ({
    id: presentacionColId(nombre),
    label: nombre,
    getValue: (m) => (getNombre(m) === nombre ? getCantidad(m) : ''),
  }));
}

export function movimientoStockColumnas(
  items: MovimientoStock[],
  productos: Producto[] = [],
): ExcelColDef<MovimientoStock>[] {
  const presentaciones = collectPresentacionNombres(items, productos);

  const cols: ExcelColDef<MovimientoStock>[] = [
    {
      id: 'fecha',
      label: 'Fecha',
      getValue: (m) => formatMovimientoStockFechaFromIso(m.fecha),
    },
    {
      id: 'tipo',
      label: 'Tipo',
      getValue: (m) =>
        m.tipo === 'ingreso' ? 'Ingreso' : m.tipo === 'egreso' ? 'Egreso' : 'División',
    },
    {
      id: 'producto',
      label: 'Producto',
      getValue: (m) => m.producto?.nombre ?? m.productoId,
      required: true,
    },
  ];

  if (presentaciones.length > 0) {
    cols.push(
      ...presentacionCantidadCols(
        presentaciones,
        presentacionNombreFromMovimiento,
        (m) => m.cantidad1 ?? 0,
      ).map((c) => ({ ...c, required: true })),
    );
  } else {
    const unidad1 = inferUnidad1(items);
    const unidad2 = inferUnidad2(items);
    cols.push({
      id: 'cant1',
      label: unidad1,
      getValue: (m) => m.cantidad1 ?? 0,
      required: true,
    });
    if (unidad2 !== null) {
      cols.push({ id: 'cant2', label: unidad2, getValue: (m) => m.cantidad2 ?? 0, required: true });
    }
  }

  cols.push(
    { id: 'cliente', label: 'Cliente', getValue: (m) => m.cliente?.nombre ?? m.clienteId ?? '' },
    { id: 'deposito', label: 'Depósito', getValue: (m) => m.deposito?.nombre ?? '' },
    { id: 'lote', label: 'Lote', getValue: (m) => m.lote ?? '' },
    { id: 'numeroRemito', label: 'N° Remito', getValue: (m) => m.numeroRemito ?? '' },
    { id: 'destinatario', label: 'Destinatario', getValue: (m) => m.destinatario ?? '' },
    { id: 'entregadoPor', label: 'Entregado por', getValue: (m) => m.entregadoPor ?? '' },
    { id: 'destino', label: 'Destino', getValue: (m) => m.destinoFinal ?? '' },
    { id: 'observaciones', label: 'Observaciones', getValue: (m) => m.observaciones ?? '' },
  );

  return cols;
}

// ── StockOperacion (nuevo modelo multi-producto) ─────────────────────────────

type OperacionFlatRow = {
  fecha: string;
  cliente: string;
  deposito: string;
  remito: string;
  producto: string;
  presentacion: string;
  bultos: number;
  sueltas: number;
  lote: string;
  vencimiento: string;
  conductor: string;
  destinatario: string;
  destino: string;
  observaciones: string;
};

export function flattenStockOperaciones(
  operaciones: StockOperacion[],
): OperacionFlatRow[] {
  const rows: OperacionFlatRow[] = [];
  for (const op of operaciones) {
    for (const mov of op.movimientos) {
      rows.push({
        fecha: formatMovimientoStockFechaFromIso(op.fecha),
        cliente: op.cliente?.nombre ?? op.clienteId,
        deposito: op.deposito?.nombre ?? op.depositoId,
        remito: op.numeroRemito ?? '',
        producto: mov.producto?.nombre ?? mov.productoId,
        presentacion: getPresentacionNombre(mov.presentacion) || mov.presentacionId || '',
        bultos: mov.bultos,
        sueltas: mov.unidades,
        lote: mov.lote ?? '',
        vencimiento: mov.fechaVencimiento
          ? formatMovimientoStockFechaFromIso(mov.fechaVencimiento)
          : '',
        conductor: op.entregadoPor ?? '',
        destinatario: op.destinatario ?? '',
        destino: op.destinoFinal ?? '',
        observaciones: op.observaciones ?? '',
      });
    }
  }
  return rows;
}

export function stockOperacionColumnas(
  tipo: 'ingreso' | 'egreso',
): ExcelColDef<OperacionFlatRow>[] {
  const cols: ExcelColDef<OperacionFlatRow>[] = [
    { id: 'fecha', label: 'Fecha', getValue: (r) => r.fecha },
    { id: 'cliente', label: 'Cliente', getValue: (r) => r.cliente },
    { id: 'deposito', label: 'Depósito', getValue: (r) => r.deposito },
    { id: 'producto', label: 'Producto', getValue: (r) => r.producto, required: true },
    { id: 'presentacion', label: 'Presentación', getValue: (r) => r.presentacion, required: true },
    { id: 'bultos', label: 'Bultos', getValue: (r) => r.bultos, required: true },
    { id: 'sueltas', label: 'Sueltas', getValue: (r) => r.sueltas, required: true },
    { id: 'lote', label: 'Lote', getValue: (r) => r.lote },
  ];

  if (tipo === 'ingreso') {
    cols.push({ id: 'vencimiento', label: 'Vencimiento', getValue: (r) => r.vencimiento });
  }

  if (tipo === 'egreso') {
    cols.push(
      { id: 'remito', label: 'N° Remito', getValue: (r) => r.remito },
      { id: 'conductor', label: 'Conductor', getValue: (r) => r.conductor },
      { id: 'destinatario', label: 'Destinatario', getValue: (r) => r.destinatario },
      { id: 'destino', label: 'Destino / Ruta', getValue: (r) => r.destino },
    );
  }

  cols.push({ id: 'observaciones', label: 'Observaciones', getValue: (r) => r.observaciones });

  return cols;
}

export function stockItemColumnas(
  items: StockItem[],
  productos: Producto[] = [],
): ExcelColDef<StockItem>[] {
  const presentaciones = collectPresentacionNombresFromStockItems(items, productos);

  const cols: ExcelColDef<StockItem>[] = [
    { id: 'deposito', label: 'Depósito', getValue: (i) => i.deposito?.nombre ?? i.depositoId },
    { id: 'cliente', label: 'Cliente', getValue: (i) => i.cliente?.nombre ?? i.clienteId },
    {
      id: 'producto',
      label: 'Producto',
      getValue: (i) => i.producto?.nombre ?? i.productoId,
      required: true,
    },
  ];

  if (presentaciones.length > 0) {
    cols.push(
      ...presentaciones.map((nombre) => ({
        id: presentacionColId(nombre),
        label: nombre,
        getValue: (i: StockItem) =>
          presentacionNombreFromStockItem(i, productos) === nombre ? i.cantidad1 : '',
        required: true,
      })),
    );
  } else {
    const unidad1 = inferUnidad1Stock(items);
    const unidad2 = inferUnidad2Stock(items);
    cols.push({ id: 'cant1', label: unidad1, getValue: (i) => i.cantidad1, required: true });
    if (unidad2 !== null) {
      cols.push({ id: 'cant2', label: unidad2, getValue: (i) => i.cantidad2, required: true });
    }
  }

  return cols;
}
