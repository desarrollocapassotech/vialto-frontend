import { BadgeDollarSign } from "lucide-react";
import { EstadoIcono } from "./EstadoIcono";
import type { EstadoValorizacionViaje } from "@/lib/viajesValorizacion";

const CLASE_VALORIZADO = "bg-emerald-100 text-emerald-800 border-emerald-500/80";
const CLASE_NO_VALORIZADO = "bg-gray-50 text-gray-400 border-gray-300/80";

/** Tooltip: estado + por qué (qué montos están cargados o cuáles faltan). */
function tooltipValorizacion(v: EstadoValorizacionViaje): string {
  if (v.valorizado) {
    return v.tieneTransportistaExterno
      ? "Valorizado\nTiene cargados los montos del cliente y del transportista."
      : "Valorizado\nTiene cargado el monto del cliente (sin transportista externo, no requiere monto de transporte).";
  }
  const lineas: string[] = [];
  if (v.faltaCliente) lineas.push("Falta cargar el monto del cliente.");
  if (v.faltaTransportista) lineas.push("Falta cargar el monto del transportista.");
  return ["No valorizado", ...lineas].join("\n");
}

/**
 * Indicador "Seguimiento de valorización" (icono $ en un sello, sin texto).
 * Destacado si el viaje tiene todos sus montos; gris si falta alguno.
 * Solo es visual: quien lo monta decide si la empresa lo tiene habilitado
 * (campo `valorizacion` de Viajes, apagado por defecto). Ocultarlo no cambia
 * las reglas que bloquean finalizar/facturar/liquidar un viaje sin montos.
 */
export function ViajeValorizacionIndicador({
  valorizacion,
}: {
  valorizacion: EstadoValorizacionViaje;
}) {
  const title = tooltipValorizacion(valorizacion);
  return (
    <EstadoIcono
      icon={BadgeDollarSign}
      colorClass={valorizacion.valorizado ? CLASE_VALORIZADO : CLASE_NO_VALORIZADO}
      title={title}
    />
  );
}
