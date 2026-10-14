import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Confirmación antes de emitir un comprobante a ARCA. Mismo texto en todos los botones de
 * emitir (facturas y liquidaciones): una vez emitido no se puede modificar, solo anular.
 */
export function ConfirmarEmisionArcaDialog({
  open,
  comprobante,
  ambiente,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  comprobante: "factura" | "liquidación";
  /** Ambiente ARCA del tenant: en homologación se aclara que no tiene validez fiscal. */
  ambiente?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const pruebas = ambiente != null && ambiente !== "produccion";
  return (
    <ConfirmDialog
      open={open}
      title={`¿Emitir la ${comprobante} en ARCA?`}
      message={
        pruebas
          ? `Se va a emitir en el ambiente de pruebas de ARCA: no tiene validez fiscal.`
          : `Se va a enviar a ARCA para obtener el CAE. Una vez emitida no se puede modificar: solo se puede anular.`
      }
      confirmLabel="Emitir"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
