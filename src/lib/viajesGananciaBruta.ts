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
  const ingresoTotal = (monto ?? 0) + extraGastos;

  paragraphs.push(
    'Imp. a facturar − Trans. ext.',
  );

  if (monto == null) {
    paragraphs.push('Importe a facturar sin cargar en este viaje.');
    return {
      display: '—',
      tooltipParagraphs: paragraphs,
    };
  }

  const impStr = formatViajeImporteForListado(monto, v.monedaMonto);

  if (gastos.length > 0) {
    paragraphs.push(
      `Importe base (${monedaIng}): ${impStr}`,
    );
    paragraphs.push(
      `Otros gastos (${monedaIng}): ${formatViajeImporteForListado(extraGastos, monedaIng)} (${gastos.filter((g) => (g.moneda === 'USD' ? 'USD' : 'ARS') === monedaIng).length} ítem/s)`,
    );
  }

  if (viajeUsaFlotaPropia(v)) {
    if (gastos.length === 0) {
      paragraphs.push(
        'Flota propia: no aplica costo de transportista externo; la ganancia bruta es igual al importe a facturar.',
      );
      paragraphs.push(`Importe a facturar (${monedaIng}): ${impStr}`);
    } else {
      paragraphs.push('Flota propia: no aplica costo de transportista externo.');
    }
    return {
      display: formatViajeImporteForListado(ingresoTotal, monedaIng),
      tooltipParagraphs: paragraphs,
    };
  }

  const costoNum = v.precioTransportistaExterno ?? 0;
  const monedaCosto = normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);

  if (costoNum > 0 && monedaIng !== monedaCosto) {
    paragraphs.push(
      'El importe a facturar y el costo externo están en monedas distintas; no se restan automáticamente.',
    );
    if (gastos.length === 0) paragraphs.push(`Importe a facturar (${monedaIng}): ${impStr}`);
    paragraphs.push(
      `Costo transportista externo (${monedaCosto}): ${formatViajeImporteForListado(
        costoNum,
        v.monedaPrecioTransportistaExterno,
      )}`,
    );
    return {
      display: '—',
      tooltipParagraphs: paragraphs,
    };
  }

  const gan = ingresoTotal - costoNum;
  if (gastos.length === 0) {
    paragraphs.push(`Importe a facturar (${monedaIng}): ${impStr}`);
  }
  if (costoNum > 0) {
    paragraphs.push(
      `Costo transportista externo (${monedaIng}): ${formatViajeImporteForListado(
        costoNum,
        v.monedaPrecioTransportistaExterno ?? v.monedaMonto,
      )}`,
    );
  } else {
    paragraphs.push('Costo transportista externo: sin cargo (0).');
  }

  return {
    display: formatViajeImporteForListado(gan, v.monedaMonto),
    tooltipParagraphs: paragraphs,
  };
}
