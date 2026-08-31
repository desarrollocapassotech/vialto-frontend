import * as XLSX from "xlsx";
import type { ExcelExportColOption } from "@/components/stock/ExcelExportModal";
import type { LiquidacionConTransportista } from "@/components/liquidaciones/LiquidacionViewModal";

const ESTADO_LABEL: Record<string, string> = {
  borrador: "BORRADOR",
  pendiente_cae: "ESPERANDO AFIP",
  autorizado: "LIQUIDADO",
  error: "ERROR DE AFIP",
  anulado: "ANULADO",
};

export const LIQUIDACIONES_EXPORT_COLUMNS: ExcelExportColOption[] = [
  { id: "transportista", label: "Transportista", required: true },
  { id: "idFiscal", label: "ID Fiscal (CUIT/RUT)" },
  { id: "periodoDesde", label: "Período Desde" },
  { id: "periodoHasta", label: "Período Hasta" },
  { id: "bruto", label: "Monto Bruto" },
  { id: "comisionPct", label: "Comisión (%)" },
  { id: "comisionMonto", label: "Comisión Monto" },
  { id: "liquido", label: "A Liquidar (Neto)" },
  { id: "estado", label: "Estado" },
  { id: "cbteNro", label: "Nº Comprobante" },
];

function fmtDate(iso: string) {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export async function generarLiquidacionesExcel(
  columnas: ExcelExportColOption[],
  liquidaciones: LiquidacionConTransportista[],
  filename: string = "liquidaciones_export",
) {
  const data = liquidaciones.map((liq) => {
    const row: Record<string, string | number> = {};

    columnas.forEach((col) => {
      switch (col.id) {
        case "transportista":
          row[col.label] = liq.transportista?.nombre ?? liq.transportistaId;
          break;
        case "idFiscal":
          row[col.label] = liq.transportista?.idFiscal || "";
          break;
        case "periodoDesde":
          row[col.label] = fmtDate(liq.periodoDesde);
          break;
        case "periodoHasta":
          row[col.label] = fmtDate(liq.periodoHasta);
          break;
        case "bruto":
          row[col.label] = liq.bruto || 0;
          break;
        case "comisionPct":
          row[col.label] = liq.comisionPct || 0;
          break;
        case "comisionMonto":
          row[col.label] = liq.comision || 0;
          break;
        case "liquido":
          row[col.label] = liq.liquido || 0;
          break;
        case "estado":
          row[col.label] = ESTADO_LABEL[liq.estado] ?? liq.estado;
          break;
        case "cbteNro":
          row[col.label] = liq.cbteNro || "";
          break;
        default:
          row[col.label] = "";
      }
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Liquidaciones");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
