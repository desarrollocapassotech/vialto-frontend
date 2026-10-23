import { fmtDateUtc } from "@/lib/fmtDateUtc";
import * as XLSX from 'xlsx';
import {
  ESTADO_DISPONIBILIDAD_LABEL,
  ESTADO_IMPUTACION_LABEL,
  ESTADO_MOVIMIENTO_EXTRA_LABEL,
  esDebeCc,
  type ExportarMovimientosResponse,
  type TipoContraparte,
} from '@/lib/cuentaCorriente';

const fmtFecha = fmtDateUtc;

/** Genera y descarga el Excel del estado de cuenta de una contraparte, mismas columnas que el ledger en pantalla. */
export function generarEstadoCuentaExcel(
  data: ExportarMovimientosResponse,
  _tipoContraparte: TipoContraparte,
  contraparteNombre: string,
) {
  // Con varias monedas, una columna de saldo por moneda ("Saldo ARS", "Saldo USD"), cada fila
  // con el saldo de todas a ese momento (igual que el PDF). Con una, "Saldo acumulado".
  const monedas = data.saldoFinal.map((s) => s.moneda);
  const multimoneda = monedas.length > 1;
  const saldosPorFila = new Map<string, Map<string, number>>();
  const corriendo = new Map(data.saldoInicial.map((s) => [s.moneda, s.saldo]));
  for (const m of [...data.movimientos].reverse()) {
    corriendo.set(m.moneda, m.saldoAcumulado);
    saldosPorFila.set(m.id, new Map(corriendo));
  }

  const rows = data.movimientos.map((m) => {
    const row: Record<string, string | number> = {
      Fecha: fmtFecha(m.fecha),
      Tipo: m.concepto,
    };
    row.Comprobante = m.numeroComprobante ?? '';
    row.Debe = esDebeCc(m) ? m.importe : '';
    row.Haber = !esDebeCc(m) ? m.importe : '';
    if (multimoneda) {
      for (const moneda of monedas) row[`Saldo ${moneda}`] = saldosPorFila.get(m.id)?.get(moneda) ?? 0;
    } else {
      row['Saldo acumulado'] = m.saldoAcumulado;
    }
    row.Moneda = m.moneda;
    // Mismo criterio que `estadoMovimientoCc` en pantalla.
    row.Estado =
      m.origen === 'anulacion'
        ? ESTADO_MOVIMIENTO_EXTRA_LABEL.anulacion
        : m.tipo === 'cargo'
          ? (ESTADO_DISPONIBILIDAD_LABEL[m.estadoDisponibilidad] ?? m.estadoDisponibilidad)
          : (ESTADO_IMPUTACION_LABEL[m.estadoImputacion] ?? m.estadoImputacion);
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  // Anchos (en caracteres) en el orden de las columnas: Fecha, Tipo, Comprobante, Debe, Haber,
  // Saldo(s), Moneda, Estado. El comprobante es el dato principal: va más ancho.
  worksheet['!cols'] = [
    { wch: 11 },
    { wch: 18 },
    {
      wch: Math.min(
        40,
        Math.max(14, ...data.movimientos.map((m) => (m.numeroComprobante ?? '').length + 2)),
      ),
    },
    { wch: 14 },
    { wch: 14 },
    ...(multimoneda ? monedas : ['']).map(() => ({ wch: 16 })),
    { wch: 8 },
    { wch: 14 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cuenta corriente');
  const nombreArchivo = contraparteNombre.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  XLSX.writeFile(workbook, `cuenta-corriente_${nombreArchivo}.xlsx`);
}
