import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
import type { Transportista } from '@/types/api';
import { useFieldConfig } from '@/hooks/useFieldConfig';
import { condicionIvaLabel } from '@/lib/arcaCbteTipo';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function TransportistaViewModal({
  transportista,
  onClose,
  editTo,
}: {
  transportista: Transportista;
  onClose: () => void;
  editTo: string;
}) {
  const { isVisible } = useFieldConfig("transportistas");
  
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <ViewModalShell
      title={transportista.nombre}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          <Link to={editTo} className={viewModalBtnPrimary}>
            Editar
          </Link>
        </>
      }
    >
      <div className={viewModalGridClass}>
        {[
          { label: 'Nombre', value: transportista.nombre, visible: true },
          { label: 'ID Fiscal', value: transportista.idFiscal, visible: isVisible("detalle_transportista", "idFiscal") },
          { label: 'País', value: transportista.pais, visible: isVisible("detalle_transportista", "pais") },
          { label: 'Email', value: transportista.email, visible: isVisible("detalle_transportista", "email") },
          { label: 'Teléfono', value: transportista.telefono, visible: isVisible("detalle_transportista", "telefono") },
          { label: 'Domicilio', value: transportista.domicilio, visible: isVisible("detalle_transportista", "domicilio") },
          { label: 'Condición IVA', value: transportista.condicionIva != null ? condicionIvaLabel(transportista.condicionIva) : null, visible: isVisible("detalle_transportista", "condicionIvaTributaria") },
          { label: 'Condición tributaria', value: transportista.condicionTributaria, visible: isVisible("detalle_transportista", "condicionIvaTributaria") },
          { label: 'PAUT', value: transportista.paut, visible: isVisible("detalle_transportista", "paut") },
          { label: 'Permiso internacional', value: transportista.permisoInternacional, visible: isVisible("detalle_transportista", "permisoInternacional") },
          { label: 'Vto. Permiso', value: transportista.fechaVencimientoPermiso ? fmtDate(transportista.fechaVencimientoPermiso) : null, visible: isVisible("detalle_transportista", "fechaVencimientoPermiso") },
          { label: 'Alta', value: fmtDate(transportista.createdAt), visible: true },
        ].filter(c => c.visible && c.value != null && c.value !== '').map((c, i) => (
          <div key={i}>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
            <p className="mt-1 text-sm">{c.value}</p>
          </div>
        ))}
      </div>
    </ViewModalShell>
  );
}
