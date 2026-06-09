import { MonedaSelect } from '@/components/forms/MonedaSelect';
import {
  otroGastoDraftToApi,
  type OtroGastoDraft,
} from '@/components/viajes/OtrosGastosFieldset';
import {
  parseCurrencyForMoneda,
  preserveAmountOnMonedaChange,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import { buildGananciaBrutaResumen } from '@/lib/viajeGananciaBrutaResumen';
import { draftRequiereGananciaBrutaManual } from '@/lib/viajesGananciaBruta';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import type { OtroGasto } from '@/types/api';

export type GananciaBrutaManualDraftSlice = {
  operacionModo: 'externo' | 'propio';
  monto: string;
  monedaMonto: ViajeMonedaCodigo;
  precioTransportistaExterno: string;
  monedaPrecioTransportistaExterno: ViajeMonedaCodigo;
  gananciaBrutaManual: string;
  monedaGananciaBrutaManual: ViajeMonedaCodigo;
  otrosGastos: OtroGastoDraft[];
};

export function gananciaBrutaResumenDesdeDraft(
  draft: GananciaBrutaManualDraftSlice,
): ReturnType<typeof buildGananciaBrutaResumen> | null {
  if (!draftRequiereGananciaBrutaManual(draft)) return null;
  const otrosGastos = draft.otrosGastos
    .map(otroGastoDraftToApi)
    .filter((g): g is OtroGasto => g != null);
  const manual = parseCurrencyForMoneda(
    draft.gananciaBrutaManual,
    draft.monedaGananciaBrutaManual,
  );
  return buildGananciaBrutaResumen({
    monto: parseCurrencyForMoneda(draft.monto, draft.monedaMonto) ?? null,
    monedaMonto: draft.monedaMonto,
    precioTransportistaExterno:
      parseCurrencyForMoneda(
        draft.precioTransportistaExterno,
        draft.monedaPrecioTransportistaExterno,
      ) ?? null,
    monedaPrecioTransportistaExterno: draft.monedaPrecioTransportistaExterno,
    otrosGastos,
    gananciaBrutaManual: manual ?? null,
    monedaGananciaBrutaManual: draft.monedaGananciaBrutaManual,
  });
}

export function gananciaBrutaManualPayloadFromDraft(draft: GananciaBrutaManualDraftSlice): {
  gananciaBrutaManual: number | null;
  monedaGananciaBrutaManual: string | null;
} {
  if (!draftRequiereGananciaBrutaManual(draft)) {
    return { gananciaBrutaManual: null, monedaGananciaBrutaManual: null };
  }
  const value = parseCurrencyForMoneda(
    draft.gananciaBrutaManual,
    draft.monedaGananciaBrutaManual,
  );
  if (value == null) {
    return { gananciaBrutaManual: null, monedaGananciaBrutaManual: null };
  }
  return {
    gananciaBrutaManual: value,
    monedaGananciaBrutaManual: draft.monedaGananciaBrutaManual,
  };
}

type Props = {
  draft: GananciaBrutaManualDraftSlice;
  onPatch: (p: Partial<Pick<GananciaBrutaManualDraftSlice, 'gananciaBrutaManual' | 'monedaGananciaBrutaManual'>>) => void;
  labelClassName: string;
  inputClassName: string;
};

export function ViajeGananciaBrutaManualFieldset({
  draft,
  onPatch,
  labelClassName,
  inputClassName,
}: Props) {
  if (!draftRequiereGananciaBrutaManual(draft)) return null;

  const resumen = gananciaBrutaResumenDesdeDraft(draft);
  const previewMeta =
    resumen && resumen.balance.length > 0
      ? {
          lineas: resumen.balance.map((l) => ({
            moneda: l.moneda,
            formatted: formatViajeImporteForListado(l.monto, l.moneda),
          })),
        }
      : null;

  return (
    <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3 rounded border border-amber-200/80 bg-amber-50/40 px-3 py-3">
      <p className="text-xs text-amber-900/90 leading-snug">
        El monto a facturar y el pago al transportista están en monedas distintas. Ingresá la
        ganancia bruta manual; los gastos extra en la misma moneda se descuentan del valor
        ingresado. Si un gasto está en otra divisa, el resultado se muestra como balance
        bimonetario.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-xl">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={labelClassName}>Ganancia bruta manual <span className="text-red-500">*</span></span>
          <div className="flex min-w-0 gap-2">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={draft.gananciaBrutaManual}
              onChange={(e) => onPatch({ gananciaBrutaManual: e.target.value })}
              placeholder="0.00"
              className={`min-w-0 flex-1 ${inputClassName} text-right tabular-nums`}
            />
            <MonedaSelect
              value={draft.monedaGananciaBrutaManual}
              onChange={(m: ViajeMonedaCodigo) =>
                onPatch({
                  monedaGananciaBrutaManual: m,
                  gananciaBrutaManual: preserveAmountOnMonedaChange(
                    draft.gananciaBrutaManual,
                    draft.monedaGananciaBrutaManual,
                    m,
                  ),
                })
              }
              aria-label="Moneda ganancia bruta manual"
            />
          </div>
        </div>
      </div>
      {previewMeta ? (
        <div className="text-sm">
          <span className={labelClassName}>Vista previa</span>
          <div className="mt-1 flex flex-col items-start gap-0.5 tabular-nums font-medium text-vialto-charcoal">
            {previewMeta.lineas.map((l) => (
              <span key={l.moneda}>{l.formatted}</span>
            ))}
          </div>
        </div>
      ) : resumen?.mensaje ? (
        <p className="text-xs text-vialto-steel">{resumen.mensaje}</p>
      ) : null}
    </div>
  );
}
