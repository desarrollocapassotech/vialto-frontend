import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import {
  STOCK_SIN_LOTE_VALUE,
  type LotesDisponiblesResponse,
} from '@/lib/stockLote';

export type LoteSelectMeta = {
  cantidad1: number | null;
  cantidad2: number | null;
  fechaVencimiento: string | null;
};

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
  required = false,
  error,
}: {
  productoId: string;
  clienteId: string;
  depositoId: string;
  presentacionId: string;
  value: string;
  onLoteChange: (lote: string, meta: LoteSelectMeta | null) => void;
  lotesBase: string;
  tenantId?: string;
  className?: string;
  disabled?: boolean;
  /** Si true, «Sin lote» solo aparece cuando hay stock sin lote; no hay opción vacía válida. */
  required?: boolean;
  error?: boolean;
}) {
  const { getToken } = useAuth();
  const [data, setData] = useState<LotesDisponiblesResponse>({ lotes: [], sinLote: null });

  const ready = Boolean(productoId && clienteId && depositoId && presentacionId);

  useEffect(() => {
    if (!ready) {
      setData({ lotes: [], sinLote: null });
      return;
    }
    const url = buildLotesUrl(lotesBase, productoId, clienteId, depositoId, presentacionId, tenantId);
    void apiJson<LotesDisponiblesResponse>(url, () => getToken())
      .then(setData)
      .catch(() => setData({ lotes: [], sinLote: null }));
  }, [productoId, clienteId, depositoId, presentacionId, lotesBase, tenantId, getToken, ready]);

  function metaForValue(selected: string): LoteSelectMeta | null {
    if (!selected) return null;
    if (selected === STOCK_SIN_LOTE_VALUE) {
      if (!data.sinLote) return null;
      return {
        cantidad1: data.sinLote.cantidad1,
        cantidad2: data.sinLote.cantidad2,
        fechaVencimiento: null,
      };
    }
    const item = data.lotes.find((l) => l.lote === selected);
    if (!item) return null;
    return {
      cantidad1: item.cantidad1,
      cantidad2: item.cantidad2,
      fechaVencimiento: item.fechaVencimiento,
    };
  }

  function handleChange(selectedLote: string) {
    onLoteChange(selectedLote, metaForValue(selectedLote));
  }

  const sinLoteLabel = data.sinLote
    ? `Sin lote (${data.sinLote.cantidad1} bulto${data.sinLote.cantidad1 !== 1 ? 's' : ''}${
        data.sinLote.cantidad2 > 0 ? `, ${data.sinLote.cantidad2} sueltas` : ''
      })`
    : 'Sin lote';

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled || !ready}
      className={`${className ?? ''} ${error ? 'border-red-400' : ''}`}
    >
      <option value="" disabled={required}>
        {required ? 'Elegí un lote…' : '— Sin lote —'}
      </option>
      {data.sinLote && (
        <option value={STOCK_SIN_LOTE_VALUE}>{sinLoteLabel}</option>
      )}
      {data.lotes.map((l) => (
        <option key={l.lote} value={l.lote}>
          {l.lote} ({l.cantidad1} bulto{l.cantidad1 !== 1 ? 's' : ''}
          {l.cantidad2 > 0 ? `, ${l.cantidad2} sueltas` : ''})
        </option>
      ))}
    </select>
  );
}
