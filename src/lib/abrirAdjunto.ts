import { detectarTipoAdjunto } from '@/lib/adjuntoPreview';
import { fetchRemitoAdjuntoBlob } from '@/lib/stockRemitoAdjunto';
import { apiFetch } from '@/lib/api';

/**
 * Cloudinary (raw/PDF) fuerza la descarga si se abre la URL directa. Traemos el archivo
 * como blob, con el MIME correcto, y abrimos su object URL (el navegador lo muestra).
 */
async function fetchUrlComoBlob(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) {
    throw new Error('No se pudo cargar el comprobante.');
  }
  const raw = await res.blob();
  const tipoUrl = detectarTipoAdjunto(url);
  let contentType =
    res.headers.get('content-type')?.split(';')[0]?.trim() || raw.type || '';

  if (!contentType || contentType === 'application/octet-stream') {
    contentType = tipoUrl === 'imagen' ? 'image/jpeg' : 'application/pdf';
  }
  if (tipoUrl === 'pdf' && !contentType.includes('pdf')) {
    contentType = 'application/pdf';
  }

  const blob = raw.type === contentType ? raw : new Blob([raw], { type: contentType });
  return URL.createObjectURL(blob);
}

/** Página mínima en la pestaña nueva mientras carga o si falla. */
function escribirEnPestana(win: Window, titulo: string, mensaje: string, esError = false) {
  try {
    win.document.title = titulo;
    win.document.body.innerHTML = '';
    const p = win.document.createElement('p');
    p.textContent = mensaje;
    p.style.cssText = `font-family:system-ui,sans-serif;margin:3rem auto;max-width:28rem;text-align:center;color:${
      esError ? '#991b1b' : '#555'
    }`;
    win.document.body.appendChild(p);
  } catch {
    /* pestaña ya cerrada */
  }
}

/**
 * Abre un adjunto (comprobante, remito, foto) en una PESTAÑA NUEVA — regla del sistema:
 * "Ver comprobante" nunca abre un modal. La pestaña se abre en el momento del click (si
 * no, el navegador la bloquea como popup), muestra "Cargando…" y después el archivo.
 */
export async function abrirAdjuntoEnPestana(
  origen: {
    url?: string;
    file?: File;
    movimientoId?: string;
    tenantId?: string;
    /** PDF que genera la API al pedirlo (ej. CVLP de una liquidación ARCA), con token. */
    apiPath?: string;
  },
  getToken: () => Promise<string | null>,
  titulo = 'Comprobante',
) {
  const win = window.open('', '_blank');
  if (win) escribirEnPestana(win, titulo, 'Cargando…');
  try {
    let objectUrl: string;
    if (origen.file) {
      objectUrl = URL.createObjectURL(origen.file);
    } else if (origen.url) {
      objectUrl = await fetchUrlComoBlob(origen.url);
    } else if (origen.apiPath) {
      const res = await apiFetch(origen.apiPath, getToken);
      if (!res.ok) throw new Error('No se pudo generar el comprobante.');
      objectUrl = URL.createObjectURL(await res.blob());
    } else if (origen.movimientoId) {
      objectUrl = (await fetchRemitoAdjuntoBlob(origen.movimientoId, getToken, origen.tenantId))
        .objectUrl;
    } else {
      throw new Error('No hay adjunto para mostrar.');
    }
    if (win) win.location.href = objectUrl;
    else window.open(objectUrl, '_blank');
    // La pestaña ya lo tomó: liberar más tarde (antes, quedaría en blanco).
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo cargar el adjunto.';
    if (win) escribirEnPestana(win, titulo, msg, true);
  }
}
