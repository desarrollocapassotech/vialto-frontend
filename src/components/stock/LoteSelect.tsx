import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

type LoteItem = { lote: string; cantidad1: number };

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
}: {
  productoId: string;
  clienteId: string;
  depositoId: string;
  presentacionId: string;
  value: string;
  /** Callback con lote seleccionado y sus bultos disponibles (null si sin lote) */
  onLoteChange: (lote: string, cantidad1: number | null) => void;
  lotesBase: string;
  tenantId?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { getToken } = useAuth();
  const [lotes, setLotes] = useState<LoteItem[]>([]);

  const ready = Boolean(productoId && clienteId && depositoId);

  useEffect(() => {
    if (!ready) {
      setLotes([]);
      return;
    }
    const url = buildLotesUrl(lotesBase, productoId, clienteId, depositoId, presentacionId, tenantId);
    void apiJson<LoteItem[]>(url, () => getToken())
      .then(setLotes)
      .catch(() => setLotes([]));
  }, [productoId, clienteId, depositoId, presentacionId, lotesBase, tenantId, getToken, ready]);

  function handleChange(selectedLote: string) {
    const item = lotes.find((l) => l.lote === selectedLote) ?? null;
    onLoteChange(selectedLote, item?.cantidad1 ?? null);
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled || !ready}
      className={className}
    >
      <option value="">— Sin lote —</option>
      {lotes.map((l) => (
        <option key={l.lote} value={l.lote}>
          {l.lote} ({l.cantidad1} bulto{l.cantidad1 !== 1 ? 's' : ''})
        </option>
      ))}
    </select>
  );
}
