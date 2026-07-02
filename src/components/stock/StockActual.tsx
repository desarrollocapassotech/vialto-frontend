import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import type { ProductoPresentacion } from "@/types/api";

export function StockActual({
  productoId,
  clienteId,
  depositoId,
  tenantId,
  getToken,
  presentaciones,
}: {
  productoId: string;
  clienteId: string;
  depositoId: string;
  tenantId?: string;
  getToken: () => Promise<string | null>;
  presentaciones: ProductoPresentacion[];
}) {
  const [stockTotal, setStockTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productoId || !clienteId || !depositoId) {
      setStockTotal(null);
      return;
    }

    let mounted = true;
    setLoading(true);

    const base = tenantId
      ? "/api/platform/stock/disponible"
      : "/api/stock/disponible";
    const params = new URLSearchParams({ productoId, clienteId, depositoId });
    if (tenantId) params.append("tenantId", tenantId);

    apiJson<any[]>(`${base}?${params.toString()}`, getToken)
      .then((items) => {
        if (!mounted) return;

        const totalUnidades = items.reduce((acc, item) => {
          const configPresentacion = presentaciones.find(
            (p) => p.id === item.presentacionId,
          );
          const unidadesPorBulto = configPresentacion?.unidadesPorBulto || 0;

          const unidadesDeBultos = (item.cantidad1 || 0) * unidadesPorBulto;
          const unidadesSueltas = item.cantidad2 || 0;

          return acc + unidadesDeBultos + unidadesSueltas;
        }, 0);

        setStockTotal(totalUnidades);
      })
      .catch((err) => {
        console.error("Error al consultar stock:", err);
        if (mounted) setStockTotal(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [productoId, clienteId, depositoId, tenantId, getToken, presentaciones]);

  if (!productoId) return null;

  return (
    <div className="mt-1.5 flex items-center text-xs text-vialto-steel bg-vialto-mist/30 px-2 py-1.5 rounded border border-black/5 w-fit">
      {loading ? (
        <>
          <Spinner className="w-3 h-3 mr-1.5 text-vialto-steel" /> Consultando
          stock...
        </>
      ) : stockTotal !== null ? (
        <>
          <span className="font-medium mr-1 text-vialto-charcoal">
            Stock Total Global:
          </span>
          {stockTotal} unidades
        </>
      ) : (
        <span className="italic">No hay stock previo registrado.</span>
      )}
    </div>
  );
}
