import { labelVehiculoTipo } from "@/lib/labels";
import type { Vehiculo } from "@/types/api";

export type CampoVehiculo = { campo: string; label: string; value: string | number | null | undefined };

function fmtFecha(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}
const fmtNum = (n: number) => n.toLocaleString("es-AR");

/**
 * Datos descriptivos de un vehículo (sin patente, km ni pertenencia), con la clave del campo
 * en la configuración de la empresa (`detalle_vehiculo`). Lo usan el tooltip de la patente y
 * las tablas de selección de vehículos; quien lo usa filtra con `isVisible`.
 */
export function camposVehiculo(v: Vehiculo): CampoVehiculo[] {
  return [
    { campo: "tipo", label: "Tipo", value: labelVehiculoTipo(v.tipo) },
    { campo: "marca", label: "Marca", value: v.marca },
    { campo: "modelo", label: "Modelo", value: v.modelo },
    { campo: "anio", label: "Año", value: v.año ?? v.anio },
    { campo: "nroChasis", label: "N.° Chasis", value: v.nroChasis },
    { campo: "poliza", label: "Póliza", value: v.poliza },
    { campo: "vencimientoPoliza", label: "Vto. Póliza", value: fmtFecha(v.vencimientoPoliza) },
    { campo: "tara", label: "Tara (kg)", value: v.tara != null ? fmtNum(v.tara) : null },
    { campo: "precinto", label: "Precinto", value: v.precinto },
  ];
}
