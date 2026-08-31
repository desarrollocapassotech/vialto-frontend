import * as XLSX from "xlsx";
import type { ExcelExportColOption } from "@/components/stock/ExcelExportModal";
import type { Factura, Cliente, Viaje } from "@/types/api";
import { textoImporteFacturaListado } from "@/lib/viajesFlota";

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  esperando_afip: "Esperando AFIP",
  facturado: "Facturado",
  error_afip: "Error de AFIP",
  anulado: "Anulado",
};

export const FACTURAS_EXPORT_COLUMNS: ExcelExportColOption[] = [
  { id: "numero", label: "Número" },
  { id: "cliente", label: "Cliente" },
  { id: "fechaEmision", label: "Fecha de Emisión" },
  { id: "fechaVencimiento", label: "Fecha de Vencimiento" },
  { id: "estado", label: "Estado" },
  { id: "importe", label: "Importe" },
];

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return "";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [_, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getEstadoDisplay(f: Factura) {
  const base =
    ESTADO_LABEL[f.estado] ??
    f.estado.charAt(0).toUpperCase() + f.estado.slice(1).replace("_", " ");
  if (f.cobrado) return `${base} (COBRADA)`;
  if (f.vencida) return `${base} (VENCIDA)`;
  return base;
}

export async function generarFacturasExcel(
  columnas: ExcelExportColOption[],
  facturas: Factura[],
  clientes: Cliente[],
  viajes: Viaje[],
  filename: string = "facturas_export",
) {
  const data = facturas.map((f) => {
    const row: Record<string, string | number> = {};

    columnas.forEach((col) => {
      switch (col.id) {
        case "numero":
          row[col.label] = f.numero || "";
          break;
        case "cliente":
          row[col.label] =
            clientes.find((c) => c.id === f.clienteId)?.nombre ??
            f.clienteId ??
            "";
          break;
        case "fechaEmision":
          row[col.label] = fmtFecha(f.fechaEmision);
          break;
        case "fechaVencimiento":
          row[col.label] = fmtFecha(f.fechaVencimiento);
          break;
        case "estado":
          row[col.label] = getEstadoDisplay(f);
          break;
        case "importe":
          row[col.label] = textoImporteFacturaListado(f, viajes);
          break;
        default:
          row[col.label] = "";
      }
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
