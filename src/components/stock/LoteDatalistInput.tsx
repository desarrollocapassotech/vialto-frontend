import { useAuth } from '@clerk/clerk-react';
import { useEffect, useId, useState } from 'react';
import { apiJson } from '@/lib/api';

function buildUrl(
  base: string,
  productoId: string,
  clienteId: string,
  depositoId: string,
  tenantId?: string,
): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  parts.push(`productoId=${encodeURIComponent(productoId)}`);
  parts.push(`clienteId=${encodeURIComponent(clienteId)}`);
  parts.push(`depositoId=${encodeURIComponent(depositoId)}`);
  return `${base}?${parts.join('&')}`;
}

export function LoteDatalistInput({
  productoId,
  clienteId,
  depositoId,
  lotesBase,
  tenantId,
  value,
  onChange,
  className,
  placeholder,
  error,
}: {
  productoId: string;
  clienteId: string;
  depositoId: string;
  lotesBase: string;
  tenantId?: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  error?: boolean;
}) {
  const { getToken } = useAuth();
  const listId = useId();
  const [sugerencias, setSugerencias] = useState<string[]>([]);

  const ready = Boolean(productoId && clienteId && depositoId);

  useEffect(() => {
    if (!ready) { setSugerencias([]); return; }
    const url = buildUrl(`${lotesBase}/historico`, productoId, clienteId, depositoId, tenantId);
    void apiJson<string[]>(url, () => getToken())
      .then(setSugerencias)
      .catch(() => setSugerencias([]));
  }, [productoId, clienteId, depositoId, lotesBase, tenantId, getToken, ready]);

  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${className ?? ''} ${error ? 'border-red-400' : ''}`}
        placeholder={placeholder ?? 'Escribí o seleccioná un lote…'}
        maxLength={200}
        autoComplete="off"
      />
      <datalist id={listId}>
        {sugerencias.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
