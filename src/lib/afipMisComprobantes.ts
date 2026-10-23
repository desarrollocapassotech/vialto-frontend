import * as XLSX from 'xlsx';
import { computeFacturaTotalesFromBases } from '@/lib/facturaTotales';
import type { TipoContraparte } from '@/lib/cuentaCorriente';

/**
 * Lector del Excel "Mis Comprobantes" de AFIP (Emitidos = ventas, Recibidos = compras).
 * Formato: una fila de título ("Mis Comprobantes Emitidos - CUIT …"), la fila de encabezados
 * (Fecha, Tipo, Punto de Venta, Número Desde, …, Nro. Doc. Receptor/Emisor, Denominación …,
 * Moneda, Neto Grav. IVA x%, IVA x%, Neto No Gravado, Op. Exentas, Otros Tributos, Imp. Total)
 * y un comprobante por fila. Las columnas se buscan por nombre, no por posición.
 */

export type LineaAfip = { descripcion: string; importe: number; ivaPct: number };

/** Comprobante listo para mandar a `POST movimientos/importar-afip`. */
export type FilaAfip = {
  fila: number;
  cuit: string;
  denominacion?: string;
  numeroComprobante: string;
  fecha: string;
  moneda: 'ARS' | 'USD';
  lineas: LineaAfip[];
  /** Total del Excel ("Imp. Total"), solo para mostrar. */
  total: number;
};

/** Fila que se descarta al leer el Excel (nota de crédito, moneda, etc.). */
export type FilaAfipDescartada = {
  fila: number;
  numeroComprobante: string;
  fecha: string;
  cuit: string;
  denominacion: string | null;
  motivo: string;
};

export type LecturaAfip = { filas: FilaAfip[]; descartadas: FilaAfipDescartada[] };

/** Alícuotas de las columnas "Neto Grav. IVA x%" del Excel. */
const ALICUOTAS: { label: string; pct: number }[] = [
  { label: '0', pct: 0 },
  { label: '2,5', pct: 2.5 },
  { label: '5', pct: 5 },
  { label: '10,5', pct: 10.5 },
  { label: '21', pct: 21 },
  { label: '27', pct: 27 },
];

function norm(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Número del Excel: viene como número o como texto ("1.234,56" / "1234.56"). */
function numero(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const t = String(v ?? '').trim();
  if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : 0;
}

const pad = (n: number, largo: number) => String(n).padStart(largo, '0');

/** Fecha del Excel (Date, número de serie o "dd/mm/aaaa") → "aaaa-mm-dd". */
function fechaIso(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1, 2)}-${pad(v.getDate(), 2)}`;
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m, 2)}-${pad(d.d, 2)}` : null;
  }
  const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${pad(Number(m[2]), 2)}-${pad(Number(m[1]), 2)}` : null;
}

/** "$" / "PES" → ARS; "DOL" / "USD" / "U$S" → USD; otra → null (no soportada). */
function monedaDe(v: unknown): 'ARS' | 'USD' | null {
  const t = norm(v);
  if (t === '' || t === '$' || t === 'pes' || t === 'ars') return 'ARS';
  if (t === 'dol' || t === 'usd' || t === 'u$s') return 'USD';
  return null;
}

export async function leerExcelMisComprobantes(file: File, lado: TipoContraparte): Promise<LecturaAfip> {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('El archivo no tiene hojas.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  // Emitidos solo en ventas, Recibidos solo en compras (lo dice el título del Excel).
  const titulo = rows.slice(0, 3).flat().map(norm).join(' ');
  if (lado === 'cliente' && titulo.includes('comprobantes recibidos')) {
    throw new Error('Este es el Excel de comprobantes RECIBIDOS: importalo desde "Nueva compra".');
  }
  if (lado === 'proveedor' && titulo.includes('comprobantes emitidos')) {
    throw new Error('Este es el Excel de comprobantes EMITIDOS: importalo desde "Nueva venta".');
  }

  const iHeader = rows.findIndex((r) => {
    const cols = (r ?? []).map(norm);
    return cols.includes('fecha') && cols.includes('tipo');
  });
  if (iHeader < 0) {
    throw new Error('No parece el Excel de "Mis Comprobantes" de AFIP: no se encontraron los encabezados.');
  }
  const header = rows[iHeader].map(norm);
  const col = (nombre: string) => header.indexOf(norm(nombre));
  const parte = lado === 'cliente' ? 'receptor' : 'emisor';
  const C = {
    fecha: col('Fecha'),
    tipo: col('Tipo'),
    pv: col('Punto de Venta'),
    nro: col('Número Desde'),
    cuit: col(`Nro. Doc. ${parte}`),
    denominacion: col(`Denominación ${parte}`),
    moneda: col('Moneda'),
    noGravado: col('Neto No Gravado'),
    exentas: col('Op. Exentas'),
    otros: col('Otros Tributos'),
    total: col('Imp. Total'),
  };
  const faltan = (['fecha', 'tipo', 'pv', 'nro', 'cuit', 'total'] as const).filter((k) => C[k] < 0);
  if (faltan.length > 0) {
    throw new Error(
      `Al Excel le faltan columnas de AFIP (${faltan.join(', ')}). Descargalo de nuevo desde "Mis Comprobantes".`,
    );
  }
  const colNeto = ALICUOTAS.map((a) => ({ ...a, i: col(`Neto Grav. IVA ${a.label}%`) }));
  const celda = (r: unknown[], i: number) => (i >= 0 ? r[i] : null);

  const filas: FilaAfip[] = [];
  const descartadas: FilaAfipDescartada[] = [];

  rows.slice(iHeader + 1).forEach((r, idx) => {
    if (!r || (celda(r, C.fecha) == null && celda(r, C.tipo) == null)) return;
    const fila = iHeader + idx + 2; // número de fila como se ve en Excel
    const tipoTxt = String(celda(r, C.tipo) ?? '').trim();
    const tipoNombre = tipoTxt.includes(' - ') ? tipoTxt.split(' - ').slice(1).join(' - ').trim() : tipoTxt;
    const numeroComprobante = `${tipoNombre} ${pad(numero(celda(r, C.pv)), 5)}-${pad(numero(celda(r, C.nro)), 8)}`;
    const fecha = fechaIso(celda(r, C.fecha)) ?? '';
    const cuit = String(celda(r, C.cuit) ?? '').replace(/\D/g, '');
    const denominacion = String(celda(r, C.denominacion) ?? '').trim() || null;
    const descartar = (motivo: string) =>
      descartadas.push({ fila, numeroComprobante, fecha, cuit, denominacion, motivo });

    // En cuenta corriente una venta/compra manual no puede ser negativa: las notas de crédito no van.
    if (/cr[eé]dito/i.test(tipoNombre)) return descartar('Nota de crédito: no se importa');
    if (!/factura|d[eé]bito/i.test(tipoNombre)) return descartar(`Tipo no soportado (${tipoTxt || 'vacío'})`);
    if (!fecha) return descartar('Fecha inválida');
    if (!cuit) return descartar('Sin CUIT');
    const moneda = monedaDe(celda(r, C.moneda));
    if (!moneda) return descartar(`Moneda no soportada (${String(celda(r, C.moneda) ?? '')})`);
    const total = numero(celda(r, C.total));
    if (total <= 0) return descartar('Importe total en cero');

    // Una línea por alícuota con neto gravado + una al 0 % con no gravado, exento y otros
    // tributos. Si el comprobante no discrimina IVA (Factura C) o la cuenta no cierra con el
    // total del Excel, una sola línea con el total (al 0 %), para no inventar IVA.
    const lineas: LineaAfip[] = colNeto
      .map((a) => ({ descripcion: `Neto gravado ${a.label}%`, importe: numero(celda(r, a.i)), ivaPct: a.pct }))
      .filter((l) => l.importe > 0);
    const sinIva = numero(celda(r, C.noGravado)) + numero(celda(r, C.exentas)) + numero(celda(r, C.otros));
    if (sinIva > 0) lineas.push({ descripcion: 'No gravado / exento / otros tributos', importe: sinIva, ivaPct: 0 });
    const totalLineas = computeFacturaTotalesFromBases(lineas).total;
    const lineasFinales =
      lineas.length > 0 && Math.abs(totalLineas - total) <= 1
        ? lineas
        : [{ descripcion: `Total ${tipoNombre}`, importe: total, ivaPct: 0 }];

    filas.push({
      fila,
      cuit,
      denominacion: denominacion ?? undefined,
      numeroComprobante,
      fecha,
      moneda,
      lineas: lineasFinales,
      total,
    });
  });

  return { filas, descartadas };
}
