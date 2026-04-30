import { normalizeViajeMoneda } from '@/lib/currencyMask';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import type { OtroGasto, Viaje } from '@/types/api';

export function viajeUsaFlotaPropia(v: Pick<Viaje, 'transportistaId'>): boolean {
  return !String(v.transportistaId ?? '').trim();
}

export type GananciaBrutaMeta = {
  display: string;
  tooltipParagraphs: string[];
};

/** Suma de otrosGastos filtrando por moneda. */
function sumaOtrosGastos(gastos: OtroGasto[], moneda: 'ARS' | 'USD'): number {
  return gastos
    .filter((g) => (g.moneda === 'USD' ? 'USD' : 'ARS') === moneda)
    .reduce((acc, g) => acc + g.monto, 0);
}

export function gananciaBrutaMetaDesdeViaje(v: Viaje): GananciaBrutaMeta {
  const paragraphs: string[] = [];
  const monto = v.monto;
  const monedaIng = normalizeViajeMoneda(v.monedaMonto);
  const gastos = v.otrosGastos ?? [];
  const extraGastos = sumaOtrosGastos(gastos, monedaIng);
  const gastosCount = gastos.filter(
    (g) => (g.moneda === 'USD' ? 'USD' : 'ARS') === monedaIng,
  ).length;

  paragraphs.push('Imp. a facturar − Trans. ext. − Gastos extra');

  if (monto == null) {
    paragraphs.push('Importe a facturar sin cargar en este viaje.');
    return { display: '—', tooltipParagraphs: paragraphs };
  }

  const impStr = formatViajeImporteForListado(monto, v.monedaMonto);
  paragraphs.push(`Importe a facturar (${monedaIng}): ${impStr}`);

  if (viajeUsaFlotaPropia(v)) {
    paragraphs.push('Transportista externo: sin cargo (flota propia).');
    if (extraGastos > 0) {
      paragraphs.push(
        `Gastos extra (${monedaIng}): −${formatViajeImporteForListado(extraGastos, monedaIng)} (${gastosCount} ítem/s)`,
      );
    } else {
      paragraphs.push('Sin otros gastos.');
    }
    return {
      display: formatViajeImporteForListado(monto - extraGastos, monedaIng),
      tooltipParagraphs: paragraphs,
    };
  }

  const costoNum = v.precioTransportistaExterno ?? 0;
  const monedaCosto = normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);

  if (costoNum > 0 && monedaIng !== monedaCosto) {
    paragraphs.push(
      'El importe a facturar y el costo externo están en monedas distintas; no se restan automáticamente.',
    );
    paragraphs.push(
      `Costo transportista externo (${monedaCosto}): ${formatViajeImporteForListado(
        costoNum,
        v.monedaPrecioTransportistaExterno,
      )}`,
    );
    if (extraGastos > 0) {
      paragraphs.push(
        `Gastos extra (${monedaIng}): −${formatViajeImporteForListado(extraGastos, monedaIng)} (${gastosCount} ítem/s)`,
      );
    }
    return { display: '—', tooltipParagraphs: paragraphs };
  }

  if (costoNum > 0) {
    paragraphs.push(
      `Costo transportista externo (${monedaIng}): −${formatViajeImporteForListado(
        costoNum,
        v.monedaPrecioTransportistaExterno ?? v.monedaMonto,
      )}`,
    );
  } else {
    paragraphs.push('Transportista externo: sin cargo (0).');
  }

  if (extraGastos > 0) {
    paragraphs.push(
      `Gastos extra (${monedaIng}): −${formatViajeImporteForListado(extraGastos, monedaIng)} (${gastosCount} ítem/s)`,
    );
  } else {
    paragraphs.push('Sin otros gastos.');
  }

  return {
    display: formatViajeImporteForListado(monto - costoNum - extraGastos, v.monedaMonto),
    tooltipParagraphs: paragraphs,
  };
}
