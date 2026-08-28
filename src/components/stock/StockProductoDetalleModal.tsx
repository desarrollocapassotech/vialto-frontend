import { useEffect, useState } from 'react';
import { ViewModalShell, viewModalBtnGhost } from '@/components/ui/ViewModalShell';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

type ComposicionItem = {
  presentacionId: string | null;
  presentacionNombre: string;
  bultos: number;
  sueltas: number;
  kg: number;
};

type ResumenProducto = {
  productoId: string;
  nombre: string;
  totalKg: number;
  composicion: ComposicionItem[];
};

const TH = 'py-2 px-3 text-left text-xs font-[family-name:var(--font-ui)] uppercase tracking-wider text-vialto-steel';
const TD = 'py-2 px-3 text-sm text-vialto-charcoal';

export function StockProductoDetalleModal({
  productoId,
  productoNombre,
  disponibleAgrupadoUrl,
  depositoId,
  tenantId,
  getToken,
  onClose,
}: {
  productoId: string;
  productoNombre: string;
  disponibleAgrupadoUrl: string;
  depositoId: string;
  tenantId?: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [resumen, setResumen] = useState<ResumenProducto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const separador = disponibleAgrupadoUrl.includes('?') ? '&' : '?';
    const url = `${disponibleAgrupadoUrl}${separador}productoId=${encodeURIComponent(productoId)}&depositoId=${encodeURIComponent(depositoId)}`;
    apiJson<ResumenProducto[]>(url, () => getToken())
      .then((data) => setResumen(data[0] ?? null))
      .catch((e) => setError(friendlyError(e, 'stock')))
      .finally(() => setLoading(false));
  }, [disponibleAgrupadoUrl, productoId, depositoId, getToken]);

  return (
    <ViewModalShell
      title={productoNombre}
      onClose={onClose}
      onOverlayClick={onClose}
      maxWidthClass="sm:max-w-2xl"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
        </div>
      }
    >
      {loading && <p className="p-4 text-sm text-vialto-steel">Cargando…</p>}

      {error && (
        <p className="p-4 text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && resumen && (
        <>
          <div className="flex items-center justify-between px-4 py-4 border-b border-black/10">
            <span className="text-sm font-medium text-vialto-charcoal">
              Total en stock
            </span>
            <span className="text-2xl font-semibold text-vialto-charcoal">
              {resumen.totalKg} kg
            </span>
          </div>

          <div className="px-4 py-4">
            <p className="text-xs font-[family-name:var(--font-ui)] uppercase tracking-wider text-vialto-steel mb-2">
              Composición
            </p>
            <div className="overflow-x-auto rounded border border-black/10">
              <table className="w-full text-sm min-w-[400px]">
                <thead className="bg-vialto-mist/40">
                  <tr>
                    <th className={TH}>Presentación</th>
                    <th className={`${TH} text-right`}>Bultos</th>
                    <th className={`${TH} text-right`}>Sueltas</th>
                    <th className={`${TH} text-right`}>Kg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {resumen.composicion.map((c, i) => (
                    <tr key={i} className="hover:bg-vialto-mist/20">
                      <td className={TD}>{c.presentacionNombre}</td>
                      <td className={`${TD} text-right tabular-nums`}>{c.bultos}</td>
                      <td className={`${TD} text-right tabular-nums`}>{c.sueltas}</td>
                      <td className={`${TD} text-right tabular-nums font-medium`}>{c.kg} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && !error && !resumen && (
        <p className="p-4 text-sm text-vialto-steel">Sin stock para este producto.</p>
      )}
    </ViewModalShell>
  );
}
