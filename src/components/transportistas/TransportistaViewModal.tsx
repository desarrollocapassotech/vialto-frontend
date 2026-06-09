import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
import type { Transportista } from '@/types/api';

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
          { label: 'Nombre', value: transportista.nombre },
          { label: 'ID Fiscal', value: transportista.idFiscal },
          { label: 'País', value: transportista.pais },
          { label: 'Email', value: transportista.email },
          { label: 'Teléfono', value: transportista.telefono },
          { label: 'Domicilio', value: transportista.domicilio },
          { label: 'Condición IVA', value: transportista.condicionIva },
          { label: 'Condición tributaria', value: transportista.condicionTributaria },
          { label: 'PAUT', value: transportista.paut },
          { label: 'Permiso internacional', value: transportista.permisoInternacional },
          { label: 'Vto. Permiso', value: transportista.fechaVencimientoPermiso ? fmtDate(transportista.fechaVencimientoPermiso) : null },
          { label: 'Alta', value: fmtDate(transportista.createdAt) },
        ].filter(c => c.value != null && c.value !== '').map((c, i) => (
          <div key={i}>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
            <p className="mt-1 text-sm">{c.value}</p>
          </div>
        ))}
      </div>
    </ViewModalShell>
  );
}
