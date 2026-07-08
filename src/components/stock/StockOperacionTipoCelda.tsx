import { PackageMinus, PackagePlus, Split } from 'lucide-react';
import {
  movimientoStockTipoBadgeClass,
  movimientoStockTipoLabel,
} from '@/lib/stockMovimientoTipo';
import type { StockOperacion } from '@/types/api';

const TIPO_ICON_WRAP: Record<StockOperacion['tipo'], string> = {
  ingreso: 'bg-emerald-100 text-emerald-800',
  egreso: 'bg-red-100 text-red-800',
  division: 'bg-amber-100 text-amber-900',
};

const TIPO_ICON: Record<StockOperacion['tipo'], typeof Split> = {
  ingreso: PackagePlus,
  egreso: PackageMinus,
  division: Split,
};

export function StockOperacionTipoCelda({ tipo }: { tipo: StockOperacion['tipo'] }) {
  const Icon = TIPO_ICON[tipo];

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TIPO_ICON_WRAP[tipo]}`}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className={movimientoStockTipoBadgeClass(tipo)}>
        {movimientoStockTipoLabel(tipo)}
      </span>
    </span>
  );
}
