import { useAuth } from '@clerk/clerk-react';
import { useCallback, useState } from 'react';
import { VisorFotos, type FotoVisor } from '@/components/ui/VisorFotos';
import { abrirAdjuntoEnPestana, esImagenAdjunto } from '@/lib/abrirAdjunto';

type OrigenAdjunto = Parameters<typeof abrirAdjuntoEnPestana>[0];

/**
 * "Ver adjunto" único: una foto/imagen se abre en `VisorFotos` (pantalla completa, zoom);
 * un documento (PDF, remito por `movimientoId`, PDF de la API) sigue en pestaña nueva.
 * Renderizar `visorAdjunto` en el JSX del componente.
 */
export function useAbrirAdjunto() {
  const { getToken } = useAuth();
  const [foto, setFoto] = useState<FotoVisor | null>(null);

  const abrirAdjunto = useCallback(
    (origen: OrigenAdjunto, titulo = 'Comprobante') => {
      if (!origen.movimientoId && !origen.apiPath && !origen.file && origen.url && esImagenAdjunto(origen)) {
        setFoto({ url: origen.url, titulo });
        return;
      }
      void abrirAdjuntoEnPestana(origen, () => getToken(), titulo);
    },
    [getToken],
  );

  const visorAdjunto = foto ? (
    <VisorFotos fotos={[foto]} onClose={() => setFoto(null)} />
  ) : null;

  return { abrirAdjunto, visorAdjunto };
}
