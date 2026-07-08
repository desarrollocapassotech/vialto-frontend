import { ArrowRight } from 'lucide-react';
import type { DivisionImpacto } from '@/lib/stockDivision';

/** Impacto de división en una sola línea: −2 Pallets → +20 Unidades */
export function DivisionImpactoLinea({
  impacto,
  className = '',
}: {
  impacto: DivisionImpacto;
  className?: string;
}) {
  const { bultosRestados, unidadesGeneradas, unidad1Nombre, unidad2Nombre } = impacto;

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${className}`.trim()}
    >
      <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-red-700 font-semibold tabular-nums">−{bultosRestados}</span>
        <span className="text-xs font-normal text-vialto-steel">{unidad1Nombre}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-vialto-steel" aria-hidden />
      <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-emerald-700 font-semibold tabular-nums">+{unidadesGeneradas}</span>
        <span className="text-xs font-normal text-vialto-steel">{unidad2Nombre}</span>
      </span>
    </span>
  );
}
