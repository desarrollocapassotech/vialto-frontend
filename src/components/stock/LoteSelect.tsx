import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import {
  STOCK_SIN_LOTE_VALUE,
  type LotesDisponiblesResponse,
} from '@/lib/stockLote';

export type LoteSelectStock = {
  bultos: number;
  sueltas: number;
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

/** Formato FEFO: «LOTE-123 (Vto: 15/08/2026)». */
function etiquetaLoteOption(lote: string, fechaVencimiento: string | null): string {
  if (!fechaVencimiento) return lote;
  const vto = formatMovimientoStockFechaFromIso(fechaVencimiento);
  if (!vto || vto === '—') return lote;
  return `${lote} (Vto: ${vto})`;
}

function compareLotesFefo(
  a: { lote: string; fechaVencimiento: string | null },
  b: { lote: string; fechaVencimiento: string | null },
): number {
  if (a.fechaVencimiento && b.fechaVencimiento) {
    const byDate = a.fechaVencimiento.localeCompare(b.fechaVencimiento);
    if (byDate !== 0) return byDate;
  } else if (a.fechaVencimiento && !b.fechaVencimiento) {
    return -1;
  } else if (!a.fechaVencimiento && b.fechaVencimiento) {
    return 1;
  }
  return a.lote.localeCompare(b.lote, 'es');
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
  requiereLote,
  placeholder,
  error,
  refreshKey,
  excludedLotes = [],
}: {
  productoId: string;
  clienteId: string;
  depositoId: string;
  presentacionId: string;
  value: string;
  /** Lote elegido y saldo disponible en ese lote (null si no hay selección válida). */
  onLoteChange: (lote: string, stock: LoteSelectStock | null) => void;
  lotesBase: string;
  tenantId?: string;
  className?: string;
  disabled?: boolean;
  /** Si true, la opción vacía no es válida. «Sin lote» sigue disponible si hay stock sin lote. */
  required?: boolean;
  /** En egresos estrictos no se ofrece «sin lote». */
  requiereLote?: boolean;
  placeholder?: string;
  error?: boolean;
  /** Incrementar tras una división u otro movimiento que altere saldos por lote. */
  refreshKey?: number;
  /** Lotes ya elegidos en otras líneas del mismo producto (no se listan salvo el valor actual). */
  excludedLotes?: string[];
}) {
  const { getToken } = useAuth();
  const [data, setData] = useState<LotesDisponiblesResponse>({ lotes: [], sinLote: null });

  const ready = Boolean(productoId && clienteId && depositoId && presentacionId);
  const isRequired = required || requiereLote;

  useEffect(() => {
    if (!ready) {
      setData({ lotes: [], sinLote: null });
      return;
    }
    const url = buildLotesUrl(lotesBase, productoId, clienteId, depositoId, presentacionId, tenantId);
    void apiJson<LotesDisponiblesResponse>(url, () => getToken())
      .then(setData)
      .catch(() => setData({ lotes: [], sinLote: null }));
  }, [
    productoId,
    clienteId,
    depositoId,
    presentacionId,
    lotesBase,
    tenantId,
    getToken,
    ready,
    refreshKey,
  ]);

  function stockForValue(selected: string): LoteSelectStock | null {
    if (!selected) return null;
    if (selected === STOCK_SIN_LOTE_VALUE) {
      if (!data.sinLote) return null;
      return {
        bultos: data.sinLote.cantidad1,
        sueltas: data.sinLote.cantidad2,
        fechaVencimiento: null,
      };
    }
    const item = data.lotes.find((l) => l.lote === selected);
    if (!item) return null;
    return {
      bultos: item.cantidad1,
      sueltas: item.cantidad2,
      fechaVencimiento: item.fechaVencimiento,
    };
  }

  function handleChange(selectedLote: string) {
    onLoteChange(selectedLote, stockForValue(selectedLote));
  }

  const sinLoteLabel = data.sinLote
    ? `Sin lote (${data.sinLote.cantidad1} bulto${data.sinLote.cantidad1 !== 1 ? 's' : ''}${
        data.sinLote.cantidad2 > 0 ? `, ${data.sinLote.cantidad2} sueltas` : ''
      })`
    : 'Sin lote';

  const emptyLabel = placeholder ?? (isRequired ? 'Elegí un lote…' : '— Sin lote —');
  const excluded = new Set(excludedLotes.filter((l) => l && l !== value));

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled || !ready}
      className={`${className ?? ''} ${error ? 'border-red-400' : ''}`}
    >
      <option value="" disabled={isRequired}>
        {emptyLabel}
      </option>
      {data.sinLote && !requiereLote && !excluded.has(STOCK_SIN_LOTE_VALUE) && (
        <option value={STOCK_SIN_LOTE_VALUE}>{sinLoteLabel}</option>
      )}
      {[...data.lotes]
        .filter((l) => !excluded.has(l.lote))
        .sort(compareLotesFefo)
        .map((l) => (
          <option key={l.lote} value={l.lote}>
            {etiquetaLoteOption(l.lote, l.fechaVencimiento)}
          </option>
        ))}
    </select>
  );
}
