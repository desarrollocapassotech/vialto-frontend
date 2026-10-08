import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { CompletarDatosFiscalesInline } from "@/components/shared/CompletarDatosFiscalesInline";
import { useHiddenFiscalFields, formatMissingFiscalField } from "@/hooks/useHiddenFiscalFields";
import { MODAL_Z_STACKED } from "@/lib/modalLayers";
import type { Cliente } from "@/types/api";

/**
 * Se abre sobre "Nueva factura" al elegir un cliente al que le faltan datos fiscales
 * que ARCA exige para emitir. Permite completarlos ahí mismo; si alguno es un campo
 * oculto para la empresa, solo informa (no se puede editar desde la UI).
 */
export function DatosClienteFaltantesModal({
  open,
  cliente,
  missingClienteFields,
  tenantId,
  getToken,
  onClienteUpdated,
  onClose,
}: {
  open: boolean;
  cliente: Cliente;
  /** Campos faltantes con prefijo "Cliente: ..." (de `collectFacturaEmitMissingFields`). */
  missingClienteFields: string[];
  tenantId?: string;
  getToken: () => Promise<string | null>;
  onClienteUpdated: (c: Cliente) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const missingHiddenFields = useHiddenFiscalFields(missingClienteFields);
  const hayOcultos = missingHiddenFields.length > 0;

  // Escape cierra solo este modal: se corta en captura para que no llegue al de la factura.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${MODAL_Z_STACKED} flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4`}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-h-[90vh] sm:max-w-lg sm:rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-black/10 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-vialto-charcoal">
              Faltan datos del cliente
            </h2>
            <p className="mt-1 text-xs text-vialto-steel">
              Para emitir una factura a ARCA, <strong className="text-vialto-charcoal">{cliente.nombre}</strong>{" "}
              necesita tener cargados:
            </p>
            <ul className="mt-1.5 list-disc pl-4 text-xs text-vialto-charcoal">
              {missingClienteFields.map((f) => (
                <li key={f}>{formatMissingFiscalField(f)}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {hayOcultos ? (
            <div className="space-y-3">
              <p
                className="rounded border border-red-500/40 bg-red-50 px-3 py-2 text-xs text-red-900"
                role="alert"
              >
                Hay campos ocultos para tu empresa que no se pueden editar desde acá. Contactá al
                administrador para habilitarlos.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-4 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
                >
                  Entendido
                </button>
              </div>
            </div>
          ) : (
            <CompletarDatosFiscalesInline
              entidad="cliente"
              id={cliente.id}
              tenantId={tenantId}
              getToken={getToken}
              forceArcaFields
              initial={{
                nombre: cliente.nombre ?? "",
                pais: cliente.pais ?? null,
                idFiscal: cliente.idFiscal ?? null,
                condicionIva: cliente.condicionIva ?? null,
                condicionTributaria: cliente.condicionTributaria ?? null,
                direccion: cliente.direccion ?? null,
              }}
              onCancel={onClose}
              cancelLabel="Completar después"
              saveLabel="Guardar"
              onSaved={(c) => {
                onClienteUpdated(c as Cliente);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
