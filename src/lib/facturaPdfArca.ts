import { apiFetch } from "@/lib/api";
import { descargarRespuesta } from "@/lib/downloadFilename";

function facturaPdfArcaPath(facturaId: string, kind: "factura" | "nc", tenantId?: string): string {
  const ruta = kind === "nc" ? "pdf-anulacion" : "pdf";
  return tenantId
    ? `/api/platform/arca/facturas/${encodeURIComponent(facturaId)}/${ruta}?tenantId=${encodeURIComponent(tenantId)}`
    : `/api/integracion-arca/facturas/${encodeURIComponent(facturaId)}/${ruta}`;
}

function errorPdf(kind: "factura" | "nc"): Error {
  return new Error(
    kind === "nc"
      ? "No se pudo generar el PDF de la nota de crédito."
      : "No se pudo generar el PDF de la factura.",
  );
}

/**
 * PDF de una factura emitida en ARCA (`kind: "factura"`) o de su nota de crédito de anulación
 * (`kind: "nc"`), generado en el momento por el backend y abierto en una pestaña nueva.
 *
 * No se usan los archivos guardados al emitir (`comprobanteUrl`/`notaCreditoUrl`): cada uno
 * quedó con el diseño vigente cuando se emitió, y la factura y su NC podían verse distintas.
 * Generándolos acá los dos salen siempre con el diseño actual (mismo criterio que el CVLP).
 *
 * La pestaña se abre en el click, antes del `await` (si no, el navegador la bloquea).
 * Ojo: el visor del navegador descarga una URL `blob:` con un nombre al azar; para bajarlo
 * con su nombre ("Factura B 00001-00000009.pdf") está `descargarPdfFacturaArca`.
 */
export async function verPdfFacturaArca(
  facturaId: string,
  kind: "factura" | "nc",
  getToken: () => Promise<string | null>,
  tenantId?: string,
): Promise<void> {
  const ventana = window.open("", "_blank");
  try {
    const res = await apiFetch(facturaPdfArcaPath(facturaId, kind, tenantId), getToken);
    if (!res.ok) throw errorPdf(kind);
    const blobUrl = URL.createObjectURL(await res.blob());
    if (ventana) ventana.location.href = blobUrl;
    else window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (e) {
    ventana?.close();
    throw e;
  }
}

/** Descarga el mismo PDF con el nombre del comprobante que arma el backend (tipo + número). */
export async function descargarPdfFacturaArca(
  facturaId: string,
  kind: "factura" | "nc",
  getToken: () => Promise<string | null>,
  tenantId?: string,
): Promise<void> {
  const res = await apiFetch(facturaPdfArcaPath(facturaId, kind, tenantId), getToken);
  if (!res.ok) throw errorPdf(kind);
  await descargarRespuesta(res, kind === "nc" ? "Nota de crédito.pdf" : "Factura.pdf");
}
