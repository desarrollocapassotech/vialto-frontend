import * as XLSX from "xlsx";
import { formatIsoFechaHoraListadoEsAr } from "@/lib/viajeFechaHora";
import { etapaViajeLabel } from "@/lib/viajesIndicadores";
import {
  clientesRutaListadoViaje,
  nombreTransportistaExternoListadoViaje,
  nombreChoferListadoViaje,
} from "@/lib/viajesFlota";
import type { Viaje, Cliente, Transportista, Chofer } from "@/types/api";
import type { ExcelExportColOption } from "@/components/stock/ExcelExportModal";

const ESTADO_LIQUIDACION_LABEL: Record<string, string> = {
  borrador: "Borrador",
  pendiente_cae: "Esperando AFIP",
  autorizado: "Liquidado",
  error: "Error de AFIP",
  anulado: "Anulado",
  sin_liquidar: "Sin liquidar",
};

export const VIAJES_EXPORT_COLUMNS: ExcelExportColOption[] = [
  { id: "numero", label: "ID Sistema", required: true },
  { id: "ctg", label: "Identificación (CTG)" },
  { id: "cliente", label: "Cliente", required: true },
  { id: "transportista", label: "Transporte" },
  { id: "chofer", label: "Chofer" },
  { id: "etapa", label: "Etapa" },
  { id: "origen", label: "Origen" },
  { id: "destino", label: "Destino" },
  { id: "fechaCarga", label: "Fecha de Carga" },
  { id: "fechaDescarga", label: "Fecha de Descarga" },
  { id: "estadoFacturacion", label: "Estado Facturación" },
  { id: "estadoPago", label: "Estado Pago Transportista" },
  { id: "estadoLiquidacion", label: "Estado Liquidación" },
];

export async function generarViajesExcel(
  columnas: ExcelExportColOption[],
  viajes: Viaje[],
  clientes: Cliente[],
  transportistas: Transportista[],
  choferes: Chofer[],
  filename: string = "viajes_export",
) {
  const data = viajes.map((v) => {
    const row: Record<string, string | number> = {};

    columnas.forEach((col) => {
      switch (col.id) {
        case "numero":
          row[col.label] = v.numero;
          break;
        case "ctg":
          row[col.label] = v.numeroIdentificacionPersonalizado || "";
          break;
        case "cliente":
          const cRuta = clientesRutaListadoViaje(v, clientes) as any[];
          row[col.label] = cRuta.map((c) => c.nombre || "").join(" | ");
          break;
        case "transportista":
          row[col.label] = nombreTransportistaExternoListadoViaje(
            v,
            transportistas,
          );
          break;
        case "chofer":
          row[col.label] = nombreChoferListadoViaje(v, choferes);
          break;
        case "etapa":
          row[col.label] = etapaViajeLabel[v.etapa] ?? v.etapa;
          break;
        case "origen":
          row[col.label] =
            typeof v.origen === "string"
              ? v.origen
              : (v.origen as any)?.nombre || "";
          break;
        case "destino":
          row[col.label] =
            typeof v.destino === "string"
              ? v.destino
              : (v.destino as any)?.nombre || "";
          break;
        case "fechaCarga":
          row[col.label] = formatIsoFechaHoraListadoEsAr(v.fechaCarga) || "";
          break;
        case "fechaDescarga":
          row[col.label] = formatIsoFechaHoraListadoEsAr(v.fechaDescarga) || "";
          break;
        case "estadoFacturacion":
          row[col.label] = (v as any).facturacionEstado || "Sin facturar";
          break;
        case "estadoPago":
          row[col.label] =
            v.pagosTransportista && v.pagosTransportista.length > 0
              ? "Registrado"
              : "Sin pagar";
          break;
        case "estadoLiquidacion":
          const estadoLiq = (v as any).liquidacionEstado;
          if (!estadoLiq) {
            row[col.label] = "Sin liquidar";
          } else {
            row[col.label] =
              ESTADO_LIQUIDACION_LABEL[estadoLiq] ??
              estadoLiq.charAt(0).toUpperCase() +
                estadoLiq.slice(1).replace("_", " ");
          }
          break;
        default:
          row[col.label] = "";
      }
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Viajes");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
