import { apiFetch } from "@/lib/api";

/**
 * PDF de una factura emitida en ARCA (`kind: "factura"`) o de su nota de crédito de anulación
 * (`kind: "nc"`), generado en el momento por el backend y abierto en una pestaña nueva.
 *
 * No se usan los archivos guardados al emitir (`comprobanteUrl`/`notaCreditoUrl`): cada uno
 * quedó con el diseño vigente cuando se emitió, y la factura y su NC podían verse distintas.
 * Generándolos acá los dos salen siempre con el diseño actual (mismo criterio que el CVLP).
 *
 * La pestaña se abre en el click, antes del `await` (si no, el navegador la bloquea).
 */
export async function verPdfFacturaArca(
  facturaId: string,
  kind: "factura" | "nc",
  getToken: () => Promise<string | null>,
  tenantId?: string,
): Promise<void> {
  const ventana = window.open("", "_blank");
  const ruta = kind === "nc" ? "pdf-anulacion" : "pdf";
  const url = tenantId
    ? `/api/platform/arca/facturas/${encodeURIComponent(facturaId)}/${ruta}?tenantId=${encodeURIComponent(tenantId)}`
    : `/api/integracion-arca/facturas/${encodeURIComponent(facturaId)}/${ruta}`;
  try {
    const res = await apiFetch(url, getToken);
    if (!res.ok) {
      throw new Error(
        kind === "nc"
          ? "No se pudo generar el PDF de la nota de crédito."
          : "No se pudo generar el PDF de la factura.",
      );
    }
    const blobUrl = URL.createObjectURL(await res.blob());
    if (ventana) ventana.location.href = blobUrl;
    else window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (e) {
    ventana?.close();
    throw e;
  }
}
