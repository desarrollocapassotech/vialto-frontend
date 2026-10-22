import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useRef } from 'react';
import { VisorFotos } from '@/components/ui/VisorFotos';
import { abrirAdjuntoEnPestana, esImagenAdjunto } from '@/lib/abrirAdjunto';

/**
 * Lo montan los "Ver comprobante" de todo el sistema al hacer click.
 * - Foto/imagen → `VisorFotos` en pantalla completa (zoom, cerrar con Esc).
 * - Documento (PDF, remito por `movimientoId`, desconocido) → pestaña nueva
 *   (`abrirAdjuntoEnPestana`) y se cierra solo.
 * Para un botón nuevo sin componente que montar, usar `useAbrirAdjunto`.
 */
export function AdjuntoPreviewModal({
  movimientoId,
  tenantId,
  file,
  url,
  title = 'Comprobante',
  onClose,
}: {
  /** Remito ya guardado en el servidor (streaming por backend). */
  movimientoId?: string;
  tenantId?: string;
  /** URL directa (Cloudinary) de un comprobante guardado. */
  url?: string;
  /** Archivo local seleccionado antes de subir. */
  file?: File;
  title?: string;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const esImagen = !movimientoId && esImagenAdjunto({ url, file });
  const urlImagen = useMemo(
    () => (esImagen ? (file ? URL.createObjectURL(file) : (url ?? null)) : null),
    [esImagen, file, url],
  );

  useEffect(() => {
    if (!urlImagen?.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(urlImagen);
  }, [urlImagen]);

  useEffect(() => {
    if (esImagen) return;
    void abrirAdjuntoEnPestana({ url, file, movimientoId, tenantId }, getToken, title);
    onCloseRef.current();
    // Una vez por montaje: cada click vuelve a montar el componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!urlImagen) return null;
  return <VisorFotos fotos={[{ url: urlImagen, titulo: title }]} onClose={onClose} />;
}
