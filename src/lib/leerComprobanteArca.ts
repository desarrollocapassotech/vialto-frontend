import { TIPOS_COMPROBANTE_MANUAL } from "@/lib/comprobanteManual";

/**
 * Lee tipo, punto de venta, número y fecha de una factura de ARCA adjunta (PDF o foto), en el
 * navegador, para autocompletar el número de comprobante (nov 2026).
 *
 * 1. PDF: el texto impreso ("Punto de Venta: 00003 Comp. Nro: 00000094", "COD. 01",
 *    "Fecha de Emisión: 13/11/2026"). Es lo más rápido y no depende de la calidad de imagen.
 * 2. Si no alcanza (PDF escaneado o foto): el QR de ARCA, que trae un JSON en base64
 *    (`https://www.afip.gob.ar/fe/qr/?p=…` con `tipoCmp`, `ptoVta`, `nroCmp`, `fecha`).
 *
 * Nunca tira: si no reconoce nada devuelve null y el usuario carga el número a mano.
 * Las librerías (pdfjs, jsQR) se cargan solo al usarse.
 */
export type ComprobanteLeido = {
  /** Código AFIP (1=A, 6=B, 11=C…), uno de `TIPOS_COMPROBANTE_MANUAL`. */
  cbteTipo: number;
  ptoVenta: number;
  cbteNro: number;
  /** YYYY-MM-DD, si se pudo leer. */
  fecha: string | null;
};

const TIPOS_VALIDOS = new Set(TIPOS_COMPROBANTE_MANUAL.map((t) => t.codigo));
/** Lado mayor del canvas para buscar el QR (más grande es lento y no mejora la lectura). */
const MAX_LADO_QR = 2000;

export async function leerComprobanteArca(file: File): Promise<ComprobanteLeido | null> {
  try {
    const esPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (esPdf) return await leerPdf(file);
    if (file.type.startsWith("image/")) return await leerImagen(file);
  } catch {
    // Archivo dañado, formato no soportado por el navegador (ej. HEIC), etc.
  }
  return null;
}

function armar(
  cbteTipo: number,
  ptoVenta: number,
  cbteNro: number,
  fecha: string | null,
): ComprobanteLeido | null {
  if (!TIPOS_VALIDOS.has(cbteTipo)) return null;
  if (!(ptoVenta >= 1 && ptoVenta <= 99999) || !(cbteNro >= 1 && cbteNro <= 99999999)) {
    return null;
  }
  return { cbteTipo, ptoVenta, cbteNro, fecha };
}

/** Texto de la factura de ARCA (Comprobantes en línea / Facturador). */
export function parsearTextoComprobanteArca(texto: string): ComprobanteLeido | null {
  const t = texto.replace(/\s+/g, " ");
  const pto = t.match(/Punto\s+de\s+Venta\s*:?\s*(\d{1,5})/i);
  const nro = t.match(/Comp\.?\s*Nro\.?\s*:?\s*(\d{1,8})/i);
  const tipo = t.match(/C[OÓ]D(?:IGO)?\.?\s*(?:N[°º]?\s*)?(\d{1,3})\b/i);
  if (!pto || !nro || !tipo) return null;
  const f = t.match(/Fecha\s+de\s+Emisi[oó]n\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  return armar(
    Number(tipo[1]),
    Number(pto[1]),
    Number(nro[1]),
    f ? `${f[3]}-${f[2]}-${f[1]}` : null,
  );
}

/** Contenido del QR de ARCA: URL con `?p=<base64 de un JSON>`. */
export function parsearQrComprobanteArca(contenido: string): ComprobanteLeido | null {
  try {
    const p = new URL(contenido.trim()).searchParams.get("p");
    if (!p) return null;
    const base64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const datos = JSON.parse(atob(base64)) as {
      fecha?: string;
      ptoVta?: number;
      tipoCmp?: number;
      nroCmp?: number;
    };
    const fecha = /^\d{4}-\d{2}-\d{2}/.test(datos.fecha ?? "") ? datos.fecha!.slice(0, 10) : null;
    return armar(Number(datos.tipoCmp), Number(datos.ptoVta), Number(datos.nroCmp), fecha);
  } catch {
    return null;
  }
}

async function leerPdf(file: File): Promise<ComprobanteLeido | null> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    // La primera página alcanza: ORIGINAL / DUPLICADO / TRIPLICADO repiten los datos.
    const pagina = await doc.getPage(1);
    const contenido = await pagina.getTextContent();
    const texto = contenido.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    const porTexto = parsearTextoComprobanteArca(texto);
    if (porTexto) return porTexto;

    // Sin texto (escaneado): se dibuja la página y se busca el QR.
    const base = pagina.getViewport({ scale: 1 });
    const escala = Math.min(3, MAX_LADO_QR / Math.max(base.width, base.height));
    const viewport = pagina.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    return await leerQrDeCanvas(canvas);
  } finally {
    void doc.destroy();
  }
}

async function leerImagen(file: File): Promise<ComprobanteLeido | null> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, MAX_LADO_QR / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(bitmap.width * escala);
  canvas.height = Math.floor(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return leerQrDeCanvas(canvas);
}

async function leerQrDeCanvas(canvas: HTMLCanvasElement): Promise<ComprobanteLeido | null> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { default: jsQR } = await import("jsqr");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
  return qr ? parsearQrComprobanteArca(qr.data) : null;
}
