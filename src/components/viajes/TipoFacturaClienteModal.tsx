import { useEffect, useRef, useState } from "react";
import {
  ARCA_CBTE_OVERRIDE_WARNING,
  condicionIvaLabel,
  facturaLetraFromCondicionIva,
  facturaLetraLabel,
  type FacturaLetra,
} from "@/lib/arcaCbteTipo";
import type { Viaje } from "@/types/api";

interface Props {
  viaje: Viaje;
  onClose: () => void;
  onConfirm: (letra: FacturaLetra) => void;
}

export function TipoFacturaClienteModal({ viaje, onClose, onConfirm }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const condicionIva = viaje.cliente?.condicionIva ?? null;
  const sugerido = facturaLetraFromCondicionIva(condicionIva);
  const [letra, setLetra] = useState<FacturaLetra>(sugerido);
  const overrideManual = letra !== sugerido;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md bg-white border border-black/10 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
              Factura a cliente
            </h2>
            <p className="text-xs text-vialto-steel mt-0.5">Tipo de comprobante</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-vialto-charcoal">
            Cliente:{" "}
            <span className="font-medium">
              {viaje.cliente?.nombre ?? viaje.clienteId}
            </span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            {(["a", "b"] as FacturaLetra[]).map((t) => {
              const selected = letra === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLetra(t)}
                  className={[
                    "flex flex-col items-center justify-center border py-4 px-2 text-xs uppercase tracking-wider transition-colors",
                    selected
                      ? "border-vialto-charcoal bg-vialto-charcoal text-white"
                      : "border-black/20 text-vialto-charcoal hover:bg-vialto-mist",
                  ].join(" ")}
                >
                  {facturaLetraLabel(t)}
                  {t === sugerido && (
                    <span className="mt-1 text-[10px] normal-case tracking-normal opacity-70">
                      Sugerido
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="rounded border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 space-y-1">
            <p>
              Corresponde a la condición frente al IVA del cliente:{" "}
              <span className="font-medium">{condicionIvaLabel(condicionIva)}</span>
              {" → "}
              <span className="font-medium">{facturaLetraLabel(sugerido)}</span>.
            </p>
            <p>{ARCA_CBTE_OVERRIDE_WARNING}</p>
            {overrideManual && (
              <p className="font-medium text-amber-900">
                Estás usando un tipo distinto al sugerido ({facturaLetraLabel(letra)}).
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(letra)}
              className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
