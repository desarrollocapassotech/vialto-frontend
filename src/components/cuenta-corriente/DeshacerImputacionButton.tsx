import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { eliminarImputacion } from '@/lib/cuentaCorriente';
import { friendlyError } from '@/lib/friendlyError';
import { useToast } from '@/lib/toast';

type DialogProps = {
  imputacionId: string;
  /** Texto de la confirmación, ej. "$ 56.000 ARS del cobro REC-0001". */
  descripcion: string;
  onCancel: () => void;
  /** Después de deshacer: recargar la grilla (y cerrar el modal que la mostraba). */
  onDeshecha: () => void;
};

/**
 * Confirmación + deshacer una imputación cobro/pago ↔ venta/compra. El backend borra la
 * imputación, recalcula los estados y revierte el pago espejado en Facturación o en Viajes.
 * Lo usan el botón de los modales y la acción "Deshacer imputación" de la fila.
 */
export function DeshacerImputacionDialog({ imputacionId, descripcion, onCancel, onDeshecha }: DialogProps) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  async function deshacer() {
    setSaving(true);
    try {
      await eliminarImputacion(() => getToken(), imputacionId);
      showToast('Imputación deshecha.', 'success');
      onDeshecha();
    } catch (err) {
      showToast(friendlyError(err, 'cuentaCorriente'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfirmDialog
      open
      title="¿Deshacer la imputación?"
      message={`Se deshace la imputación de ${descripcion}. El cobro/pago vuelve a quedar disponible y la venta/compra vuelve a quedar pendiente por ese importe.`}
      confirmLabel="Deshacer"
      cancelLabel="Cancelar"
      tone="danger"
      busy={saving}
      onCancel={onCancel}
      onConfirm={() => void deshacer()}
    />
  );
}

type ButtonProps = Omit<DialogProps, 'onCancel'>;

/** Botón "Deshacer" de un renglón de imputación (modales de detalle). */
export function DeshacerImputacionButton({ imputacionId, descripcion, onDeshecha }: ButtonProps) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        title="Deshacer imputación"
        className="inline-flex shrink-0 items-center gap-1 border border-black/15 px-2 py-1 text-[11px] uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
      >
        <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        Deshacer
      </button>
      {confirmando && (
        <DeshacerImputacionDialog
          imputacionId={imputacionId}
          descripcion={descripcion}
          onCancel={() => setConfirmando(false)}
          onDeshecha={() => {
            setConfirmando(false);
            onDeshecha();
          }}
        />
      )}
    </>
  );
}
