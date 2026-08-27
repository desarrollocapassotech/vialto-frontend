import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
import { condicionIvaLabel } from '@/lib/arcaCbteTipo';
import type { Cliente } from '@/types/api';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function labelCondicionCliente(c: Cliente): string | null {
  if (c.pais === 'AR') {
    return c.condicionIva != null ? condicionIvaLabel(c.condicionIva) : null;
  }
  return c.condicionTributaria?.trim() || null;
}

export function ClienteViewModal({
  cliente,
  onClose,
  editTo,
}: {
  cliente: Cliente;
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
      title={cliente.nombre}
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
          { label: 'Nombre', value: cliente.nombre },
          { label: 'ID Fiscal', value: cliente.idFiscal },
          { label: 'País', value: cliente.pais },
          {
            label: cliente.pais === 'AR' ? 'Condición IVA' : 'Condición tributaria',
            value: labelCondicionCliente(cliente),
          },
          { label: 'Email', value: cliente.email },
          { label: 'Teléfono', value: cliente.telefono },
          { label: 'Dirección', value: cliente.direccion },
          { label: 'Alta', value: fmtDate(cliente.createdAt) },
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
