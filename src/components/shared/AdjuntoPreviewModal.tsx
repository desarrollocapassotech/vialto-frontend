import { useAuth } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';
import { abrirAdjuntoEnPestana } from '@/lib/abrirAdjunto';

/**
 * Lo montan los "Ver comprobante" de todo el sistema al hacer click. Ya no es un modal
 * (regla del sistema): abre el adjunto en una pestaña nueva (`abrirAdjuntoEnPestana`) y
 * se cierra solo. Para un botón nuevo, llamar `abrirAdjuntoEnPestana` directo.
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

  useEffect(() => {
    void abrirAdjuntoEnPestana({ url, file, movimientoId, tenantId }, getToken, title);
    onCloseRef.current();
    // Una vez por montaje: cada click vuelve a montar el componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
