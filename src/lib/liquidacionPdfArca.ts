import { apiFetch } from "@/lib/api";
import { descargarRespuesta } from "@/lib/downloadFilename";

/**
 * Descarga el PDF del CVLP (`kind: "liquidacion"`) o de la NC/ND que lo anuló (`kind: "anulacion"`)
 * con el nombre del comprobante que arma el backend ("Liquido Producto A 00002-00000123.pdf",
 * "Nota de Crédito A …"). Ver la contraparte de facturas en `descargarPdfFacturaArca`.
 * Con `tenantId` (superadmin mirando otra empresa) el backend lo resuelve con `resolveTenantId`.
 */
export async function descargarPdfLiquidacionArca(
  liquidacionId: string,
  kind: "liquidacion" | "anulacion",
  getToken: () => Promise<string | null>,
  tenantId?: string,
): Promise<void> {
  const ruta = kind === "anulacion" ? "pdf-anulacion" : "pdf";
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const res = await apiFetch(
    `/api/integracion-arca/liquidaciones/${encodeURIComponent(liquidacionId)}/${ruta}${qs}`,
    getToken,
  );
  if (!res.ok) {
    throw new Error(
      kind === "anulacion"
        ? "No se pudo generar el PDF de la anulación."
        : "No se pudo generar el PDF de la liquidación.",
    );
  }
  await descargarRespuesta(
    res,
    kind === "anulacion" ? "Anulación de liquidación.pdf" : "Liquidación.pdf",
  );
}
