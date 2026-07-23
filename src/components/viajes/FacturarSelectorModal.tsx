import { useEffect, useRef } from 'react';
import { Check, Receipt, Users } from 'lucide-react';

interface Props {
  onFacturarCliente: () => void;
  onLiquidacion: () => void;
  onClose: () => void;
  clienteCompletado?: boolean;
  transportistaCompletado?: boolean;
  /** Motivo para deshabilitar «Factura a cliente» (ej. ARCA + USD). */
  clienteBloqueadoMotivo?: string | null;
  /** Motivo para deshabilitar «Liquidación a transportista» (ej. ARCA + USD). */
  transportistaBloqueadoMotivo?: string | null;
  /** Subtítulo bajo «Factura a cliente» (default: Registro manual). */
  subtituloCliente?: string;
  /** Subtítulo bajo «Liquidación a transportista». */
  subtituloTransportista?: string;
}

function OpcionComprobante({
  titulo,
  subtitulo,
  completado,
  bloqueadoMotivo,
  icon: Icon,
  onClick,
}: {
  titulo: string;
  subtitulo: string;
  completado: boolean;
  bloqueadoMotivo?: string | null;
  icon: typeof Receipt;
  onClick: () => void;
}) {
  const bloqueado = Boolean(bloqueadoMotivo);
  const disabled = completado || bloqueado;
  const textoSecundario = completado
    ? 'Ya registrado'
    : bloqueado
      ? bloqueadoMotivo!
      : subtitulo;

  return (
    <button
      type="button"
      disabled={disabled}
      title={bloqueado ? bloqueadoMotivo ?? undefined : undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={`w-full flex items-center gap-4 border px-4 py-4 text-left transition-colors ${
        disabled
          ? 'border-black/10 bg-vialto-mist/40 cursor-not-allowed opacity-60'
          : 'border-black/15 hover:bg-vialto-mist group'
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors ${
          disabled ? 'bg-white/80' : 'bg-vialto-mist group-hover:bg-white'
        }`}
      >
        {completado ? (
          <Check className="h-5 w-5 text-emerald-700" strokeWidth={2} />
        ) : (
          <Icon className="h-5 w-5 text-vialto-charcoal" strokeWidth={1.75} />
        )}
      </div>
      <div className="min-w-0">
        <p
          className={`text-sm font-medium ${
            completado ? 'text-vialto-steel line-through' : 'text-vialto-charcoal'
          }`}
        >
          {titulo}
        </p>
        <p
          className={`text-xs mt-0.5 ${
            bloqueado && !completado ? 'text-amber-800' : 'text-vialto-steel'
          }`}
        >
          {textoSecundario}
        </p>
      </div>
    </button>
  );
}

export function FacturarSelectorModal({
  onFacturarCliente,
  onLiquidacion,
  onClose,
  clienteCompletado = false,
  transportistaCompletado = false,
  clienteBloqueadoMotivo = null,
  transportistaBloqueadoMotivo = null,
  subtituloCliente = "Registro manual",
  subtituloTransportista = "Registro manual",
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm bg-white border border-black/10 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
            Registrar comprobante
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <OpcionComprobante
            titulo="Factura a cliente"
            subtitulo={subtituloCliente}
            completado={clienteCompletado}
            bloqueadoMotivo={clienteCompletado ? null : clienteBloqueadoMotivo}
            icon={Receipt}
            onClick={() => {
              onFacturarCliente();
              onClose();
            }}
          />

          <OpcionComprobante
            titulo="Liquidación a transportista"
            subtitulo={subtituloTransportista}
            completado={transportistaCompletado}
            bloqueadoMotivo={
              transportistaCompletado ? null : transportistaBloqueadoMotivo
            }
            icon={Users}
            onClick={() => {
              onLiquidacion();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
