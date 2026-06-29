import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { FileText } from 'lucide-react';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { useToast } from '@/lib/toast';
import { friendlyError } from '@/lib/friendlyError';
import { fetchRemitoInternoPdfBlob } from '@/lib/ensureRemitoInterno';
import { Spinner } from '@/components/ui/Spinner';

const BTN_BASE =
  'inline-flex items-center gap-1.5 text-xs uppercase tracking-wider border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50';

export function ImprimirRemitoButton({
  egresoId,
  tenantId,
  titulo = 'Remito interno',
  className,
  disabled = false,
  variant = 'default',
}: {
  egresoId?: string;
  tenantId?: string;
  titulo?: string;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'compact' | 'listado' | 'subtle';
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const isDisabled = disabled || loading || !egresoId;

  async function handleVerRemito() {
    if (!egresoId) return;
    setLoading(true);
    try {
      const { objectUrl } = await fetchRemitoInternoPdfBlob(egresoId, getToken, tenantId);
      setViewerUrl(objectUrl);
    } catch (e) {
      showToast(friendlyError(e, 'stock'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (viewerUrl?.startsWith('blob:')) URL.revokeObjectURL(viewerUrl);
    };
  }, [viewerUrl]);

  const icon = loading ? (
    <Spinner className="h-3.5 w-3.5 shrink-0" />
  ) : (
    <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={variant === 'subtle' ? 1.5 : 1.75} aria-hidden />
  );

  const button =
    variant === 'subtle' ? (
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => void handleVerRemito()}
        title={
          disabled
            ? 'Guardá el egreso para ver el remito en PDF'
            : 'Ver remito en PDF'
        }
        className={`inline-flex items-center gap-1.5 text-xs text-vialto-steel hover:text-vialto-charcoal transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-vialto-steel ${className ?? ''}`}
      >
        {icon}
        Remito
      </button>
    ) : variant === 'listado' ? (
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => void handleVerRemito()}
        className={className}
        title="Ver remito en PDF"
      >
        {icon}
        <span className="sr-only md:not-sr-only">Remito</span>
      </button>
    ) : (
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => void handleVerRemito()}
        className={`${BTN_BASE} ${variant === 'compact' ? 'h-8 px-2 py-1' : 'h-9 px-3 py-2'} ${className ?? ''}`}
        title="Ver remito en PDF"
      >
        {icon}
        Remito
      </button>
    );

  return (
    <>
      {button}
      {viewerUrl && (
        <AdjuntoPreviewModal
          url={viewerUrl}
          title={titulo}
          onClose={() => {
            if (viewerUrl.startsWith('blob:')) URL.revokeObjectURL(viewerUrl);
            setViewerUrl(null);
          }}
        />
      )}
    </>
  );
}
