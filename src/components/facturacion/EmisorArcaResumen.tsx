import { ParteFacturaResumen } from "@/components/facturacion/ParteFacturaResumen";
import type { ArcaConfig } from "@/types/api";

/** Datos fiscales del emisor (CUIT, domicilio, IIBB, inicio de actividades) en un solo texto multilínea. */
function detalleEmisor(arcaConfig: ArcaConfig): string {
  return [
    `CUIT ${arcaConfig.cuitEmisor ?? "—"}`,
    arcaConfig.domicilioEmisor?.trim(),
    `Ing. Brutos: ${arcaConfig.ingBrutos?.trim() || "—"}`,
    `Inic. act.: ${arcaConfig.inicActEmisor?.trim() || "—"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function EmisorArcaResumen({ arcaConfig }: { arcaConfig: ArcaConfig | null }) {
  return (
    <ParteFacturaResumen
      titulo="Emisor"
      nombre={arcaConfig?.razonSocial}
      detalle={arcaConfig ? detalleEmisor(arcaConfig) : undefined}
    />
  );
}
