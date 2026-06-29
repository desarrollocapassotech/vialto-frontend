import { useSearchParams } from 'react-router-dom';
import { useEntityList } from '@/hooks/useEntityList';
import { useProductosPaginated } from '@/hooks/useProductosPaginated';
import { buildQs } from '@/lib/queryString';
import type { Cliente, Deposito } from '@/types/api';

/**
 * Centraliza el uso de filtros compartidos entre los historiales de Stock
 * (Ingresos, Egresos): lectura de filtros desde la URL, armado de params
 * para el fetch principal, y carga de las listas para los selectores
 * (Cliente, Depósito, Producto).
 */
export function useHistorialStockFiltros(
  platform: boolean,
  tenantId: string | undefined,
  getToken: () => Promise<string | null>,
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const clienteId = searchParams.get('clienteId') ?? '';
  const depositoId = searchParams.get('depositoId') ?? '';
  const productoId = searchParams.get('productoId') ?? '';
  const fechaDesde = searchParams.get('fechaDesde') ?? '';
  const fechaHasta = searchParams.get('fechaHasta') ?? '';

  const params: Record<string, string> = {};
  if (clienteId) params.clienteId = clienteId;
  if (depositoId) params.depositoId = depositoId;
  if (productoId) params.productoId = productoId;
  if (fechaDesde) params.fechaDesde = fechaDesde;
  if (fechaHasta) params.fechaHasta = fechaHasta;

  const clientesBase = platform ? '/api/platform/clientes' : '/api/clientes';
  const depositosBase = platform ? '/api/platform/stock/depositos' : '/api/stock/depositos';
  const productosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';

  const { items: clientes } = useEntityList<Cliente>(
    `${clientesBase}${buildQs({}, tenantId)}`,
    getToken,
  );
  const { items: depositos } = useEntityList<Deposito>(
    `${depositosBase}${buildQs({}, tenantId)}`,
    getToken,
  );
  const { productos } = useProductosPaginated(productosBase, tenantId, getToken);

  return {
    searchParams,
    setSearchParams,
    clienteId,
    depositoId,
    productoId,
    fechaDesde,
    fechaHasta,
    params,
    clientes,
    depositos,
    productos,
  };
}