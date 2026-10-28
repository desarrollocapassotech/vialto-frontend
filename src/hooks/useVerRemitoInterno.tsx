import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { useToast } from '@/lib/toast';
import { friendlyError } from '@/lib/friendlyError';
import { fetchRemitoInternoPdfBlob } from '@/lib/ensureRemitoInterno';

/**
 * Versión imperativa de `ImprimirRemitoButton`, para usar como acción de una grilla
 * (`rowActions`). Renderizar `{visorRemito}` en el JSX.
 */
export function useVerRemitoInterno(tenantId?: string) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [visor, setVisor] = useState<{ url: string; titulo: string } | null>(null);

  async function verRemito(egresoId: string, titulo = 'Remito interno') {
    try {
      const { objectUrl } = await fetchRemitoInternoPdfBlob(egresoId, getToken, tenantId);
      setVisor({ url: objectUrl, titulo });
    } catch (e) {
      showToast(friendlyError(e, 'stock'));
    }
  }

  useEffect(() => {
    return () => {
      if (visor?.url.startsWith('blob:')) URL.revokeObjectURL(visor.url);
    };
  }, [visor]);

  const visorRemito = visor ? (
    <AdjuntoPreviewModal url={visor.url} title={visor.titulo} onClose={() => setVisor(null)} />
  ) : null;

  return { verRemito, visorRemito };
}
