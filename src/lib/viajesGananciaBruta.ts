import { normalizeViajeMoneda } from '@/lib/currencyMask';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import type { Viaje } from '@/types/api';

export function viajeUsaFlotaPropia(v: Pick<Viaje, 'transportistaId'>): boolean {
  return !String(v.transportistaId ?? '').trim();
}

export type GananciaBrutaMeta = {
  display: string;
  tooltipParagraphs: string[];
};

/**
 * Ganancia bruta = importe a facturar − costo transportista externo.
 * Con flota propia no aplica costo externo: coincide con el importe a facturar.
 */
export function gananciaBrutaMetaDesdeViaje(v: Viaje): GananciaBrutaMeta {
  const paragraphs: string[] = [];
  const monto = v.monto;
  const monedaIng = normalizeViajeMoneda(v.monedaMonto);

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

  if (viajeUsaFlotaPropia(v)) {
    paragraphs.push(
      'Flota propia: no aplica costo de transportista externo; la ganancia bruta es igual al importe a facturar.',
    );
    paragraphs.push(`Importe a facturar (${monedaIng}): ${impStr}`);
    return {
      display: formatViajeImporteForListado(monto, v.monedaMonto),
      tooltipParagraphs: paragraphs,
    };
  }

  const costoNum = v.precioTransportistaExterno ?? 0;
  const monedaCosto = normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);

  if (costoNum > 0 && monedaIng !== monedaCosto) {
    paragraphs.push(
      'El importe a facturar y el costo externo están en monedas distintas; no se restan automáticamente.',
    );
    paragraphs.push(`Importe a facturar (${monedaIng}): ${impStr}`);
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

  const gan = monto - costoNum;
  paragraphs.push(`Importe a facturar (${monedaIng}): ${impStr}`);
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
