import type { MovimientoStock, StockItem } from '@/types/api';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';

export interface ExcelColDef<T> {
  id: string;
  label: string;
  getValue: (row: T) => string | number;
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

export function movimientoStockColumnas(
  items: MovimientoStock[],
): ExcelColDef<MovimientoStock>[] {
  const unidad1 = inferUnidad1(items);
  const unidad2 = inferUnidad2(items);

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
    },
    {
      id: 'cant1',
      label: unidad1,
      getValue: (m) => m.cantidad1,
    },
  ];

  if (unidad2 !== null) {
    cols.push({ id: 'cant2', label: unidad2, getValue: (m) => m.cantidad2 });
  }

  cols.push(
    { id: 'cliente', label: 'Cliente', getValue: (m) => m.cliente?.nombre ?? m.clienteId },
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

export function stockItemColumnas(items: StockItem[]): ExcelColDef<StockItem>[] {
  const unidad1 = inferUnidad1Stock(items);
  const unidad2 = inferUnidad2Stock(items);

  const cols: ExcelColDef<StockItem>[] = [
    { id: 'deposito', label: 'Depósito', getValue: (i) => i.deposito?.nombre ?? i.depositoId },
    { id: 'cliente', label: 'Cliente', getValue: (i) => i.cliente?.nombre ?? i.clienteId },
    { id: 'producto', label: 'Producto', getValue: (i) => i.producto?.nombre ?? i.productoId },
    { id: 'cant1', label: unidad1, getValue: (i) => i.cantidad1 },
  ];

  if (unidad2 !== null) {
    cols.push({ id: 'cant2', label: unidad2, getValue: (i) => i.cantidad2 });
  }

  return cols;
}
