import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

export type LoteDisponible = { lote: string; cantidad1: number; cantidad2: number };

function buildLotesUrl(
  base: string,
  productoId: string,
  clienteId: string,
  depositoId: string,
  presentacionId: string,
  tenantId?: string,
): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  parts.push(`productoId=${encodeURIComponent(productoId)}`);
  parts.push(`clienteId=${encodeURIComponent(clienteId)}`);
  parts.push(`depositoId=${encodeURIComponent(depositoId)}`);
  if (presentacionId) parts.push(`presentacionId=${encodeURIComponent(presentacionId)}`);
  return `${base}?${parts.join('&')}`;
}

export function LoteSelect({
  productoId,
  clienteId,
  depositoId,
  presentacionId,
  value,
  onLoteChange,
  lotesBase,
  tenantId,
  className,
  disabled,
  requiereLote,
  placeholder,
}: {
  productoId: string;
  clienteId: string;
  depositoId: string;
  presentacionId: string;
  value: string;
  /** Lote elegido y saldo disponible en ese lote (null si no hay selección válida). */
  onLoteChange: (
    lote: string,
    stock: { bultos: number; sueltas: number } | null,
  ) => void;
  lotesBase: string;
  tenantId?: string;
  className?: string;
  disabled?: boolean;
  /** En egresos el lote es obligatorio: no se ofrece «sin lote». */
  requiereLote?: boolean;
  placeholder?: string;
}) {
  const { getToken } = useAuth();
  const [lotes, setLotes] = useState<LoteDisponible[]>([]);

  const ready = Boolean(productoId && clienteId && depositoId);

  useEffect(() => {
    if (!ready) {
      setLotes([]);
      return;
    }
    const url = buildLotesUrl(lotesBase, productoId, clienteId, depositoId, presentacionId, tenantId);
    void apiJson<LoteDisponible[]>(url, () => getToken())
      .then(setLotes)
      .catch(() => setLotes([]));
  }, [productoId, clienteId, depositoId, presentacionId, lotesBase, tenantId, getToken, ready]);

  function stockDesdeLote(selectedLote: string): { bultos: number; sueltas: number } | null {
    if (!selectedLote.trim()) return null;
    const item = lotes.find((l) => l.lote === selectedLote);
    if (!item) return null;
    return { bultos: item.cantidad1, sueltas: item.cantidad2 };
  }

  function handleChange(selectedLote: string) {
    onLoteChange(selectedLote, stockDesdeLote(selectedLote));
  }

  const emptyLabel = placeholder ?? (requiereLote ? 'Elegí un lote…' : '— Sin lote —');

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled || !ready}
      className={className}
    >
      <option value="">{emptyLabel}</option>
      {lotes.map((l) => (
        <option key={l.lote} value={l.lote}>
          {l.lote} ({l.cantidad1} bulto{l.cantidad1 !== 1 ? 's' : ''}
          {l.cantidad2 > 0 ? `, ${l.cantidad2} suelta${l.cantidad2 !== 1 ? 's' : ''}` : ''})
        </option>
      ))}
    </select>
  );
}
