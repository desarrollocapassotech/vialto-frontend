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
  tipoContraparte: TipoContraparte,
  contraparteNombre: string,
) {
  const rows = data.movimientos.map((m) => {
    const row: Record<string, string | number> = {
      Fecha: fmtFecha(m.fecha),
      Concepto: m.concepto,
    };
    if (tipoContraparte === 'cliente') {
      row.Comprobante = m.numeroComprobante ?? '';
    }
    row.Debe = esDebeCc(m) ? m.importe : '';
    row.Haber = !esDebeCc(m) ? m.importe : '';
    row['Saldo acumulado'] = m.saldoAcumulado;
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
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cuenta corriente');
  const nombreArchivo = contraparteNombre.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  XLSX.writeFile(workbook, `cuenta-corriente_${nombreArchivo}.xlsx`);
}
