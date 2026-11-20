import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  fetchViajesParaCompra,
  repartirEnPartesIguales,
  type ViajeCompraCc,
} from '@/lib/cuentaCorriente';
import {
  formatCurrencyArFromNumber,
  maskCurrencyArInput,
  parseCurrencyAr,
} from '@/lib/currencyMask';
import { fmtDateUtc } from '@/lib/fmtDateUtc';
import { marcarModalModificado } from '@/lib/descarteModal';

const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';
const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

type ViajeOpcion = Omit<ViajeCompraCc, 'importe'>;

/** Viaje elegido con su parte del neto como texto editable. */
export type ViajeCompraDraft = ViajeOpcion & { importeStr: string };

export function viajeCompraDraftFromApi(v: ViajeCompraCc): ViajeCompraDraft {
  return { ...v, importeStr: formatCurrencyArFromNumber(v.importe) };
}

export function viajesCompraToApi(rows: ViajeCompraDraft[]) {
  return rows.map((r) => ({ viajeId: r.viajeId, importe: parseCurrencyAr(r.importeStr) ?? 0 }));
}

/** Error de validación del reparto, o null si está bien (sin viajes también está bien). */
export function errorRepartoViajes(rows: ViajeCompraDraft[], neto: number): string | null {
  if (rows.length === 0) return null;
  if (rows.some((r) => !((parseCurrencyAr(r.importeStr) ?? 0) > 0))) {
    return 'Cada viaje tiene que llevar un importe mayor a cero.';
  }
  const suma = rows.reduce((s, r) => s + (parseCurrencyAr(r.importeStr) ?? 0), 0);
  if (Math.abs(suma - neto) > 0.01) {
    return `El reparto entre los viajes ($ ${formatCurrencyArFromNumber(suma)}) tiene que sumar el importe sin IVA de la compra ($ ${formatCurrencyArFromNumber(neto)}).`;
  }
  return null;
}

function etiquetaViaje(v: ViajeOpcion): string {
  const ruta = [v.origen, v.destino].filter(Boolean).join(' → ');
  return [v.fechaCarga ? fmtDateUtc(v.fechaCarga) : null, v.cliente, ruta].filter(Boolean).join(' · ');
}

/**
 * Viajes de una compra (opcional): se eligen uno o varios y se reparte el importe sin IVA
 * entre ellos. Mientras no se toque ningún importe, el reparto es en partes iguales y se
 * recalcula solo al cambiar el neto o los viajes.
 */
export function ViajesCompraField({
  neto,
  moneda,
  value,
  onChange,
  marcarError = false,
  repartoManualInicial = false,
}: {
  neto: number;
  moneda: string;
  value: ViajeCompraDraft[];
  onChange: (rows: ViajeCompraDraft[]) => void;
  marcarError?: boolean;
  /** Edición de una compra ya vinculada: respeta el reparto guardado. */
  repartoManualInicial?: boolean;
}) {
  const { getToken } = useAuth();
  const [abierto, setAbierto] = useState(value.length > 0);
  const [q, setQ] = useState('');
  const [opciones, setOpciones] = useState<ViajeOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [repartoManual, setRepartoManual] = useState(repartoManualInicial);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(() => {
      fetchViajesParaCompra(() => getToken(), q)
        .then((r) => !cancelado && setOpciones(r))
        .catch(() => !cancelado && setOpciones([]))
        .finally(() => !cancelado && setBuscando(false));
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [abierto, q, getToken]);

  /** Reparto en partes iguales del neto entre los viajes dados. */
  function enPartesIguales(rows: ViajeOpcion[]): ViajeCompraDraft[] {
    const partes = repartirEnPartesIguales(neto, rows.length);
    return rows.map((r, i) => ({ ...r, importeStr: formatCurrencyArFromNumber(partes[i] ?? 0) }));
  }

  // Sin reparto a mano, acompaña los cambios del neto.
  useEffect(() => {
    if (repartoManual || value.length === 0) return;
    const nuevo = enPartesIguales(value);
    if (nuevo.some((r, i) => r.importeStr !== value[i].importeStr)) onChange(nuevo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neto, repartoManual]);

  const elegidos = useMemo(() => new Set(value.map((v) => v.viajeId)), [value]);
  const suma = value.reduce((s, r) => s + (parseCurrencyAr(r.importeStr) ?? 0), 0);
  const descuadre = value.length > 0 && Math.abs(suma - neto) > 0.01;

  function toggle(v: ViajeOpcion) {
    marcarModalModificado();
    const base = elegidos.has(v.viajeId)
      ? value.filter((r) => r.viajeId !== v.viajeId)
      : [...value, { ...v, importeStr: '' }];
    onChange(repartoManual ? base : enPartesIguales(base));
  }

  function quitar(viajeId: string) {
    marcarModalModificado();
    const base = value.filter((r) => r.viajeId !== viajeId);
    onChange(repartoManual ? base : enPartesIguales(base));
  }

  if (!abierto) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="text-xs uppercase tracking-wider text-vialto-steel underline-offset-2 hover:text-vialto-charcoal hover:underline"
        >
          + Vincular a viajes
        </button>
        <p className="mt-1 text-xs text-vialto-steel">
          Opcional: el importe sin IVA se carga como gasto de los viajes que elijas.
        </p>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className={labelClass}>Viajes</legend>
      <p className="mb-2 text-xs text-vialto-steel">
        Opcional. El importe sin IVA ($ {formatCurrencyArFromNumber(neto)} {moneda}) se reparte entre
        los viajes elegidos y se suma a sus gastos.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Buscador de viajes */}
        <div>
          <input
            type="search"
            data-descarte-ignorar
            className={`${inputClass} mb-2`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número, cliente, origen o destino…"
            aria-label="Buscar viajes"
          />
          <div className="max-h-56 overflow-y-auto border border-black/15 bg-white text-sm">
            {buscando && opciones.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-vialto-steel">Buscando…</p>
            ) : opciones.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-vialto-steel">Sin viajes.</p>
            ) : (
              opciones.map((v) => (
                <label
                  key={v.viajeId}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-vialto-mist"
                >
                  <input type="checkbox" checked={elegidos.has(v.viajeId)} onChange={() => toggle(v)} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{v.numero}</span>
                    <span className="ml-2 text-xs text-vialto-steel">{etiquetaViaje(v)}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Reparto */}
        <div>
          {value.length === 0 ? (
            <p className="text-xs text-vialto-steel">Todavía no elegiste viajes.</p>
          ) : (
            <>
              <ul className="divide-y divide-black/10 border border-black/15 bg-white text-sm">
                {value.map((r) => (
                  <li key={r.viajeId} className="flex items-center gap-2 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate" title={etiquetaViaje(r)}>
                      <span className="font-medium">{r.numero}</span>
                      <span className="ml-2 text-xs text-vialto-steel">{etiquetaViaje(r)}</span>
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Importe del viaje ${r.numero}`}
                      className={`h-8 w-32 border px-2 text-right text-sm tabular-nums ${
                        marcarError && !((parseCurrencyAr(r.importeStr) ?? 0) > 0)
                          ? 'border-red-400'
                          : 'border-black/15'
                      }`}
                      value={r.importeStr}
                      onChange={(e) => {
                        setRepartoManual(true);
                        onChange(
                          value.map((x) =>
                            x.viajeId === r.viajeId
                              ? { ...x, importeStr: maskCurrencyArInput(e.target.value) }
                              : x,
                          ),
                        );
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => quitar(r.viajeId)}
                      aria-label={`Quitar el viaje ${r.numero}`}
                      className="shrink-0 p-1 text-vialto-steel hover:text-red-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                <span className={descuadre ? 'text-red-700' : 'text-vialto-steel'}>
                  Repartido: $ {formatCurrencyArFromNumber(suma)} de $ {formatCurrencyArFromNumber(neto)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    marcarModalModificado();
                    setRepartoManual(false);
                    onChange(enPartesIguales(value));
                  }}
                  className="uppercase tracking-wider text-vialto-steel underline-offset-2 hover:text-vialto-charcoal hover:underline"
                >
                  Repartir en partes iguales
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </fieldset>
  );
}
