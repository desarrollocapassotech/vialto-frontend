import { useMemo } from 'react';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel } from '@/components/crud/CrudFields';
import {
  isFacturaTramoCompleto,
  type FacturaTramoDraft,
} from '@/components/facturacion/FacturaTramosEditor';
import type { Factura, Viaje } from '@/types/api';
import { numeroVisibleViaje } from '@/lib/viajesFlota';
import {
  computeFacturaTotalesFromBases,
  importeNetoViajeParaFactura,
} from '@/lib/facturaTotales';

export type FacturaLineaDraft = {
  descripcion: string;
  importe: number;
  importeStr?: string;
  ivaPct?: number;
};

const inputClass =
  'h-9 w-full rounded border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35';

function fmtMoney(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseImporte(raw: string): number {
  if (raw.trim() === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function displayImporteStr(linea: FacturaLineaDraft): string {
  return linea.importeStr ?? (linea.importe > 0 ? String(linea.importe) : '');
}

export function isFacturaLineaCompleta(l: FacturaLineaDraft): boolean {
  return Boolean(l.descripcion.trim()) && Number(l.importe) > 0;
}

export function validateFacturaLineasDraft(
  lineas: FacturaLineaDraft[],
): { ok: true } | { ok: false; message: string; indices: number[] } {
  if (lineas.length === 0) {
    return { ok: false, message: 'Agregá al menos una línea con importe.', indices: [] };
  }
  const indices = lineas
    .map((l, i) => (isFacturaLineaCompleta(l) ? -1 : i))
    .filter((i) => i >= 0);
  if (indices.length === 0) return { ok: true };
  return {
    ok: false,
    indices,
    message:
      indices.length === 1
        ? 'Hay una línea incompleta. Completá descripción e importe o quitala.'
        : `Hay ${indices.length} líneas incompletas. Completá descripción e importe o quitalas.`,
  };
}

export function toFacturaLineasPayload(lineas: FacturaLineaDraft[]) {
  return lineas
    .filter(isFacturaLineaCompleta)
    .map((l) => ({
      descripcion: l.descripcion.trim(),
      importe: l.importe,
      ...(l.ivaPct != null ? { ivaPct: l.ivaPct } : {}),
    }));
}

function lineasFromTramos(
  viajeIds: string[],
  viajes: Viaje[],
  tramos: FacturaTramoDraft[],
  ivaPctHeader: number,
  fallbackDescripcion: string,
): FacturaLineaDraft[] | null {
  const completos = tramos.filter(isFacturaTramoCompleto);
  if (completos.length === 0) return null;

  const viajeIdsConTramo = new Set(completos.map((t) => t.viajeId));
  const lineas: FacturaLineaDraft[] = completos.map((t) => {
    const v = viajes.find((x) => x.id === t.viajeId);
    const nro = v ? numeroVisibleViaje(v) : '—';
    return {
      descripcion: `Viaje #${nro} · ${t.detalle.trim()}`,
      importe: t.monto,
      ivaPct: t.ivaPct,
    };
  });

  for (const id of viajeIds) {
    if (viajeIdsConTramo.has(id)) continue;
    const v = viajes.find((x) => x.id === id);
    if (!v) continue;
    const ruta = v.origen && v.destino ? ` ${v.origen} — ${v.destino}` : '';
    const monto = importeNetoViajeParaFactura(v);
    lineas.push({
      descripcion: `Viaje #${numeroVisibleViaje(v)}${ruta}`,
      importe: monto,
      ivaPct: ivaPctHeader,
    });
  }

  const netoLineas = lineas.reduce((s, l) => s + l.importe, 0);
  if (netoLineas > 0) return lineas;
  return [
    {
      descripcion: fallbackDescripcion,
      importe: 0,
      ivaPct: ivaPctHeader,
    },
  ];
}

export function defaultFacturaLineasFromDraft(
  draft: {
    viajeIds: string[];
    ivaPct: string;
    numero: string;
    facturarPorTramo?: boolean;
    tramos?: FacturaTramoDraft[];
  },
  viajes: Viaje[],
): FacturaLineaDraft[] {
  const ivaPct = draft.ivaPct.trim() !== '' ? Number(draft.ivaPct) : 21;
  if (draft.facturarPorTramo && (draft.tramos?.length ?? 0) > 0) {
    const fromTramos = lineasFromTramos(
      draft.viajeIds,
      viajes,
      draft.tramos ?? [],
      ivaPct,
      `Factura ${draft.numero.trim() || '—'}`,
    );
    if (fromTramos) return fromTramos;
  }

  const linked = viajes.filter((v) => draft.viajeIds.includes(v.id));
  if (linked.length > 0) {
    const lineas = linked.map((v) => {
      const ruta = v.origen && v.destino ? ` ${v.origen} — ${v.destino}` : '';
      const monto = importeNetoViajeParaFactura(v);
      return {
        descripcion: `Viaje #${numeroVisibleViaje(v)}${ruta}`,
        importe: monto,
        ivaPct,
      };
    });
    const netoLineas = lineas.reduce((s, l) => s + l.importe, 0);
    if (netoLineas > 0) return lineas;
    const importe = linked.reduce((s, v) => s + importeNetoViajeParaFactura(v), 0);
    if (importe > 0) {
      return [
        {
          descripcion:
            lineas.length === 1
              ? lineas[0].descripcion
              : `Factura ${draft.numero.trim() || '—'}`,
          importe,
          ivaPct,
        },
      ];
    }
    return lineas;
  }
  return [
    {
      descripcion: 'Servicios de transporte',
      importe: 0,
      ivaPct,
    },
  ];
}

export function defaultFacturaLineas(
  factura: Factura,
  viajes: Viaje[],
): FacturaLineaDraft[] {
  const ivaPct = factura.ivaPct ?? 21;
  if (factura.facturarPorTramo && (factura.tramos?.length ?? 0) > 0) {
    const tramosDraft: FacturaTramoDraft[] = (factura.tramos ?? []).map((t) => ({
      viajeId: t.viajeId,
      detalle: t.detalle,
      monto: t.monto,
      ivaPct: t.ivaPct,
    }));
    const fromTramos = lineasFromTramos(
      factura.viajeIds,
      viajes,
      tramosDraft,
      ivaPct,
      `Factura ${factura.numero}`,
    );
    if (fromTramos) {
      const neto = fromTramos.reduce((s, l) => s + l.importe, 0);
      if (neto > 0) return fromTramos;
      if (factura.importe > 0) {
        return [
          {
            descripcion: `Factura ${factura.numero}`,
            importe: factura.importe,
            ivaPct,
          },
        ];
      }
      return fromTramos;
    }
  }

  const linked = viajes.filter((v) => factura.viajeIds.includes(v.id));
  if (linked.length > 0) {
    const lineas = linked.map((v) => {
      const ruta = v.origen && v.destino ? ` ${v.origen} — ${v.destino}` : '';
      const monto = importeNetoViajeParaFactura(v);
      return {
        descripcion: `Viaje #${numeroVisibleViaje(v)}${ruta}`,
        importe: monto,
        ivaPct,
      };
    });
    const netoLineas = lineas.reduce((s, l) => s + l.importe, 0);
    if (netoLineas > 0) return lineas;
    // Viajes sin monto cargado: una sola línea con el importe de la factura.
    if (factura.importe > 0) {
      return [
        {
          descripcion: lineas.length === 1
            ? lineas[0].descripcion
            : `Factura ${factura.numero}`,
          importe: factura.importe,
          ivaPct,
        },
      ];
    }
    return lineas;
  }
  return [
    {
      descripcion: 'Servicios de transporte',
      importe: factura.importe,
      ivaPct,
    },
  ];
}

export function computeFacturaTotales(
  lineas: FacturaLineaDraft[],
  ivaPctDefault: number,
) {
  return computeFacturaTotalesFromBases(
    lineas.filter(isFacturaLineaCompleta).map((l) => ({
      importe: l.importe,
      ivaPct: l.ivaPct ?? ivaPctDefault,
    })),
  );
}

interface Props {
  lineas: FacturaLineaDraft[];
  onChange: (next: FacturaLineaDraft[]) => void;
  ivaPctDefault: number;
  disabled?: boolean;
  incompleteIndices?: number[];
}

export function FacturaLineasEditor({
  lineas,
  onChange,
  ivaPctDefault,
  disabled,
  incompleteIndices = [],
}: Props) {
  const totales = useMemo(
    () => computeFacturaTotales(lineas, ivaPctDefault),
    [lineas, ivaPctDefault],
  );

  function updateLinea(index: number, patch: Partial<FacturaLineaDraft>) {
    onChange(lineas.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLinea() {
    onChange([
      ...lineas,
      { descripcion: '', importe: 0, importeStr: '', ivaPct: ivaPctDefault },
    ]);
  }

  function removeLinea(index: number) {
    onChange(lineas.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-vialto-steel">
          Conceptos / líneas
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={addLinea}
          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
        >
          + Agregar línea
        </button>
      </div>

      {lineas.length === 0 && (
        <p className="text-xs text-vialto-steel border border-black/10 bg-vialto-mist/40 px-3 py-2">
          Sin líneas. Agregá al menos una con descripción e importe neto.
        </p>
      )}

      {lineas.map((linea, index) => {
        const incomplete = incompleteIndices.includes(index);
        return (
          <div
            key={index}
            className={[
              'grid gap-2 sm:grid-cols-[1fr_120px_80px_auto] items-end border p-3',
              incomplete ? 'border-red-300 bg-red-50/40' : 'border-black/10 bg-vialto-mist/30',
            ].join(' ')}
          >
            <div>
              <CrudFieldLabel required>Descripción</CrudFieldLabel>
              <input
                type="text"
                value={linea.descripcion}
                disabled={disabled}
                onChange={(e) => updateLinea(index, { descripcion: e.target.value })}
                className={inputClass}
                placeholder="Ej. Flete viaje #123"
              />
            </div>
            <div>
              <CrudFieldLabel required>Importe neto</CrudFieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={disabled}
                value={displayImporteStr(linea)}
                onChange={(e) => {
                  const importeStr = e.target.value;
                  updateLinea(index, {
                    importeStr,
                    importe: parseImporte(importeStr),
                  });
                }}
                className={inputClass}
              />
            </div>
            <div>
              <CrudFieldLabel>IVA %</CrudFieldLabel>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                disabled={disabled}
                value={linea.ivaPct ?? ivaPctDefault}
                onChange={(e) =>
                  updateLinea(index, { ivaPct: Number(e.target.value) || ivaPctDefault })
                }
                className={inputClass}
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeLinea(index)}
              className="h-9 px-2 text-xs uppercase tracking-wider text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
              aria-label="Quitar línea"
            >
              Quitar
            </button>
            {incomplete && (
              <div className="sm:col-span-4">
                <CrudFieldError message="Completá descripción e importe neto." />
              </div>
            )}
          </div>
        );
      })}

      {lineas.length > 0 && (
        <div className="bg-vialto-mist/50 px-3 py-2 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-vialto-steel">Neto gravado</span>
            <span className="tabular-nums">{fmtMoney(totales.neto)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-vialto-steel">IVA</span>
            <span className="tabular-nums">{fmtMoney(totales.iva)}</span>
          </div>
          <div className="flex justify-between font-semibold text-vialto-charcoal border-t border-black/10 pt-1">
            <span>Total</span>
            <span className="tabular-nums">{fmtMoney(totales.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
