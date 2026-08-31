import { Button } from "@/components/ui/Button";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import {
  ChoferSearchSelect,
  TransportistaSearchSelect,
} from "@/components/forms/MaestroSearchSelects";
import { MonedaSelect } from "@/components/forms/MonedaSelect";
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from "@/components/viajes/ViajeOperacionTipoFieldset";
import {
  ViajeGananciaBrutaManualFieldset,
  type GananciaBrutaManualDraftSlice,
} from "@/components/viajes/ViajeGananciaBrutaManualFieldset";
import {
  ViajeVehiculosLista,
  type ViajeVehiculoRowDraft,
} from "@/components/viajes/ViajeVehiculosLista";
import {
  PagosTransportistaFieldset,
  emptyPagoTransportista,
  type PagoTransportistaDraft,
} from "@/components/viajes/PagosTransportistaFieldset";
import type { ViajeMonedaCodigo } from "@/lib/currencyMask";
import type { Chofer, Transportista, Vehiculo } from "@/types/api";

const fieldLabelClass =
  "text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel";
const inputClass = "h-9 w-full border border-black/15 bg-white px-2 text-sm";
const readonlyMoneyClass =
  "flex items-center px-3 h-10 rounded-md border border-gray-200 bg-gray-50 text-gray-500 text-right tabular-nums min-w-0";

function fmtReadonlyMoney(n: number) {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface Props {
  modoOperacion: ViajeOperacionModo;
  onModoChange: (m: ViajeOperacionModo) => void;

  // Transportista externo
  transportistaId: string;
  onTransportistaIdChange: (id: string) => void;
  transportistas: Transportista[];
  fieldErrorTransportistaId?: string;
  onNuevoTransportista: () => void;

  desgloseActivo: boolean;
  ivaTransportistaVisible: boolean;

  cantidadTransportista: string;
  onCantidadTransportistaChange: (v: string) => void;
  fieldErrorCantidadTransportista?: string;

  precioUnitarioTransportista: string;
  onPrecioUnitarioTransportistaChange: (v: string) => void;
  fieldErrorPrecioUnitarioTransportista?: string;

  monedaPrecioTransportista: ViajeMonedaCodigo;
  onMonedaPrecioTransportistaChange: (m: ViajeMonedaCodigo) => void;

  precioTransportistaIvaIncluidoPct: string;
  onPrecioTransportistaIvaIncluidoPctChange: (v: string) => void;

  desglosePagoBruto: number;
  desglosePagoNeto: number;
  desgloseMontoIva: number;

  precioTransportistaExterno: string;
  onPrecioTransportistaExternoChange: (v: string) => void;
  fieldErrorPrecioTransportistaExterno?: string;

  realizaFlete: boolean;
  onRealizaFleteChange: (v: boolean) => void;
  transportistaEfectivoId: string;
  onTransportistaEfectivoIdChange: (id: string) => void;
  transportistaEfectivoError: string | null;

  choferExternoId: string;
  onChoferExternoIdChange: (id: string) => void;
  choferesExterno: Chofer[];
  onNuevoChoferExterno: () => void;

  vehiculosExternosRows: ViajeVehiculoRowDraft[];
  onVehiculosExternosRowsChange: (rows: ViajeVehiculoRowDraft[]) => void;

  // Flota propia
  choferId: string;
  onChoferIdChange: (id: string) => void;
  choferesPropios: Chofer[];
  onNuevoChoferPropio: () => void;
  ayudaFlotaChofer?: string;
  vehiculosRows: ViajeVehiculoRowDraft[];
  onVehiculosRowsChange: (rows: ViajeVehiculoRowDraft[]) => void;
  vehiculosPropios: Vehiculo[];
  ayudaFlotaVehiculo?: string;

  vehiculos: Vehiculo[];
  onRefreshVehiculosPropios: () => void;
  onRefreshVehiculosExternos: () => void;
  refreshingFlota: boolean;
  getToken: () => Promise<string | null>;
  tenantId: string;
  onVehiculoCreado: (v: Vehiculo) => void;

  mostrarChoferExterno: boolean;
  mostrarVehiculosExternos: boolean;
  mostrarChoferPropio: boolean;
  mostrarVehiculosPropios: boolean;

  // Ganancia bruta manual
  mostrarGananciaBrutaManual: boolean;
  gananciaDraft: GananciaBrutaManualDraftSlice;
  onGananciaBrutaManualPatch: (
    p: Partial<Pick<GananciaBrutaManualDraftSlice, "gananciaBrutaManual" | "monedaGananciaBrutaManual">>,
  ) => void;

  // Pagos al transportista
  mostrarPagosTransportista: boolean;
  pagosTransportista: PagoTransportistaDraft[];
  onPagosTransportistaChange: (rows: PagoTransportistaDraft[]) => void;

  error: string | null;
  onVolver: () => void;
  onContinuar: () => void;
}

export function ViajeCreateStep2Operacion({
  modoOperacion,
  onModoChange,
  transportistaId,
  onTransportistaIdChange,
  transportistas,
  fieldErrorTransportistaId,
  onNuevoTransportista,
  desgloseActivo,
  ivaTransportistaVisible,
  cantidadTransportista,
  onCantidadTransportistaChange,
  fieldErrorCantidadTransportista,
  precioUnitarioTransportista,
  onPrecioUnitarioTransportistaChange,
  fieldErrorPrecioUnitarioTransportista,
  monedaPrecioTransportista,
  onMonedaPrecioTransportistaChange,
  precioTransportistaIvaIncluidoPct,
  onPrecioTransportistaIvaIncluidoPctChange,
  desglosePagoBruto,
  desglosePagoNeto,
  desgloseMontoIva,
  precioTransportistaExterno,
  onPrecioTransportistaExternoChange,
  fieldErrorPrecioTransportistaExterno,
  realizaFlete,
  onRealizaFleteChange,
  transportistaEfectivoId,
  onTransportistaEfectivoIdChange,
  transportistaEfectivoError,
  choferExternoId,
  onChoferExternoIdChange,
  choferesExterno,
  onNuevoChoferExterno,
  vehiculosExternosRows,
  onVehiculosExternosRowsChange,
  choferId,
  onChoferIdChange,
  choferesPropios,
  onNuevoChoferPropio,
  ayudaFlotaChofer,
  vehiculosRows,
  onVehiculosRowsChange,
  vehiculosPropios,
  ayudaFlotaVehiculo,
  vehiculos,
  onRefreshVehiculosPropios,
  onRefreshVehiculosExternos,
  refreshingFlota,
  getToken,
  tenantId,
  onVehiculoCreado,
  mostrarChoferExterno,
  mostrarVehiculosExternos,
  mostrarChoferPropio,
  mostrarVehiculosPropios,
  mostrarGananciaBrutaManual,
  gananciaDraft,
  onGananciaBrutaManualPatch,
  mostrarPagosTransportista,
  pagosTransportista,
  onPagosTransportistaChange,
  error,
  onVolver,
  onContinuar,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <ViajeOperacionTipoFieldset
        modo={modoOperacion}
        onModoChange={onModoChange}
        className="min-w-0 space-y-3 border-0 p-0 [&:disabled]:opacity-60"
        externoContent={
          <div className="grid gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className={fieldLabelClass}>
                Transportista externo <span className="text-red-500">*</span>
              </span>
              <TransportistaSearchSelect
                transportistas={transportistas}
                value={transportistaId}
                onChange={onTransportistaIdChange}
                inputClassName={inputClass}
                aria-label="Transportista externo"
                onNuevo={onNuevoTransportista}
              />
              <CrudFieldError message={fieldErrorTransportistaId} />
            </div>
            {desgloseActivo ? (
              <>
                <div
                  className={`grid grid-cols-1 gap-3 ${ivaTransportistaVisible ? "sm:grid-cols-[0.6fr_1.4fr_1fr]" : "sm:grid-cols-[0.6fr_1.4fr]"}`}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={fieldLabelClass}>Cantidad</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={cantidadTransportista}
                      onChange={(e) => onCantidadTransportistaChange(e.target.value)}
                      placeholder="0.00"
                      className={`${inputClass} text-right tabular-nums ${fieldErrorCantidadTransportista ? "border-red-400" : ""}`}
                    />
                    <CrudFieldError message={fieldErrorCantidadTransportista} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={fieldLabelClass}>Precio unitario</span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={precioUnitarioTransportista}
                        onChange={(e) => onPrecioUnitarioTransportistaChange(e.target.value)}
                        placeholder="0.00"
                        className={`min-w-0 flex-1 ${inputClass} text-right tabular-nums ${fieldErrorPrecioUnitarioTransportista ? "border-red-400" : ""}`}
                      />
                      <MonedaSelect
                        value={monedaPrecioTransportista}
                        onChange={onMonedaPrecioTransportistaChange}
                        aria-label="Moneda precio unitario transportista"
                      />
                    </div>
                    <CrudFieldError message={fieldErrorPrecioUnitarioTransportista} />
                  </div>
                  {ivaTransportistaVisible && (
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={fieldLabelClass}>% de IVA</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={precioTransportistaIvaIncluidoPct}
                        onChange={(e) => onPrecioTransportistaIvaIncluidoPctChange(e.target.value)}
                        placeholder="0"
                        className={`${inputClass} text-right tabular-nums`}
                      />
                      <p className="text-xs text-vialto-steel">
                        Dejalo en 0 si el transportista no suma IVA al cobrar.
                      </p>
                    </div>
                  )}
                </div>
                {ivaTransportistaVisible ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={fieldLabelClass}>Pago bruto a transporte</span>
                      <div className={readonlyMoneyClass}>
                        <span className="w-full truncate">{fmtReadonlyMoney(desglosePagoBruto)}</span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={fieldLabelClass}>Pago neto</span>
                      <div className={readonlyMoneyClass}>
                        <span className="w-full truncate">{fmtReadonlyMoney(desglosePagoNeto)}</span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={fieldLabelClass}>Monto IVA</span>
                      <div className={readonlyMoneyClass}>
                        <span className="w-full truncate">{fmtReadonlyMoney(desgloseMontoIva)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-col gap-1 sm:max-w-xs">
                    <span className={fieldLabelClass}>Pago bruto a transporte</span>
                    <div className={readonlyMoneyClass}>
                      <span className="w-full truncate">{fmtReadonlyMoney(desglosePagoBruto)}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={`grid grid-cols-1 gap-3 ${ivaTransportistaVisible ? "sm:grid-cols-2" : ""}`}>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={fieldLabelClass}>Precio transporte</span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={precioTransportistaExterno}
                        onChange={(e) => onPrecioTransportistaExternoChange(e.target.value)}
                        placeholder="0.00"
                        className={`min-w-0 flex-1 ${inputClass} text-right tabular-nums ${fieldErrorPrecioTransportistaExterno ? "border-red-400" : ""}`}
                      />
                      <MonedaSelect
                        value={monedaPrecioTransportista}
                        onChange={onMonedaPrecioTransportistaChange}
                        aria-label="Moneda precio transportista externo"
                      />
                    </div>
                    <CrudFieldError message={fieldErrorPrecioTransportistaExterno} />
                  </div>
                  {ivaTransportistaVisible && (
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={fieldLabelClass}>% de IVA</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={precioTransportistaIvaIncluidoPct}
                        onChange={(e) => onPrecioTransportistaIvaIncluidoPctChange(e.target.value)}
                        placeholder="0"
                        className={`${inputClass} text-right tabular-nums`}
                      />
                      <p className="text-xs text-vialto-steel">
                        Dejalo en 0 si el transportista no suma IVA al cobrar.
                      </p>
                    </div>
                  )}
                </div>
                {ivaTransportistaVisible && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={fieldLabelClass}>Pago bruto a transporte</span>
                      <div className={readonlyMoneyClass}>
                        <span className="w-full truncate">{fmtReadonlyMoney(desglosePagoBruto)}</span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={fieldLabelClass}>Pago neto</span>
                      <div className={readonlyMoneyClass}>
                        <span className="w-full truncate">{fmtReadonlyMoney(desglosePagoNeto)}</span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={fieldLabelClass}>Monto IVA</span>
                      <div className={readonlyMoneyClass}>
                        <span className="w-full truncate">{fmtReadonlyMoney(desgloseMontoIva)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {transportistaId && (
              <div className="flex flex-col gap-2 rounded border border-black/10 bg-vialto-mist/40 px-3 py-3">
                <span className={fieldLabelClass}>
                  ¿El transportista seleccionado realiza el flete?
                </span>
                <div className="flex gap-5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="realiza-flete-create"
                      checked={realizaFlete}
                      onChange={() => onRealizaFleteChange(true)}
                      className="accent-vialto-charcoal"
                    />
                    Sí
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="realiza-flete-create"
                      checked={!realizaFlete}
                      onChange={() => onRealizaFleteChange(false)}
                      className="accent-vialto-charcoal"
                    />
                    No
                  </label>
                </div>
                {!realizaFlete && (
                  <div className="flex min-w-0 flex-col gap-1 mt-1">
                    <span className={fieldLabelClass}>
                      Transportista que realiza el flete <span className="text-red-500">*</span>
                    </span>
                    <TransportistaSearchSelect
                      transportistas={transportistas.filter((t) => t.id !== transportistaId)}
                      value={transportistaEfectivoId}
                      onChange={onTransportistaEfectivoIdChange}
                      inputClassName={`${inputClass}${transportistaEfectivoError ? " border-red-400" : ""}`}
                      aria-label="Transportista que realiza el flete"
                      onNuevo={onNuevoTransportista}
                    />
                    {transportistaEfectivoError && (
                      <span className="text-xs text-red-600">{transportistaEfectivoError}</span>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-3">
              {mostrarChoferExterno && (
                <div className="flex min-w-0 flex-col gap-1 max-w-md">
                  <span className={fieldLabelClass}>Chofer</span>
                  <ChoferSearchSelect
                    choferes={choferesExterno}
                    value={choferExternoId}
                    onChange={onChoferExternoIdChange}
                    inputClassName={inputClass}
                    aria-label="Chofer transportista externo"
                    onNuevo={onNuevoChoferExterno}
                  />
                </div>
              )}
              {mostrarVehiculosExternos && (
                <ViajeVehiculosLista
                  groupId="viaje-create-ext"
                  crearVehiculoHref={
                    tenantId ? `/vehiculos/nuevo?tenantId=${encodeURIComponent(tenantId)}` : "/vehiculos/nuevo"
                  }
                  rows={vehiculosExternosRows}
                  onChange={onVehiculosExternosRowsChange}
                  vehiculos={vehiculos}
                  alMenosUno={false}
                  onRefreshVehiculos={onRefreshVehiculosExternos}
                  refreshingVehiculos={refreshingFlota}
                  getToken={getToken}
                  tenantId={tenantId || undefined}
                  onVehiculoCreado={onVehiculoCreado}
                />
              )}
            </div>
          </div>
        }
        propioContent={
          <div className="grid gap-3">
            {mostrarChoferPropio && (
              <div className="flex min-w-0 flex-col gap-1 max-w-md">
                <span className={fieldLabelClass}>Chofer (flota propia)</span>
                <ChoferSearchSelect
                  choferes={choferesPropios}
                  value={choferId}
                  onChange={onChoferIdChange}
                  inputClassName={inputClass}
                  aria-label="Chofer flota propia"
                  onNuevo={onNuevoChoferPropio}
                />
                {ayudaFlotaChofer && <p className="text-xs text-vialto-steel">{ayudaFlotaChofer}</p>}
              </div>
            )}
            {mostrarVehiculosPropios && (
              <>
                <ViajeVehiculosLista
                  groupId="viaje-create-propio"
                  crearVehiculoHref={
                    tenantId ? `/vehiculos/nuevo?tenantId=${encodeURIComponent(tenantId)}` : "/vehiculos/nuevo"
                  }
                  rows={vehiculosRows}
                  onChange={onVehiculosRowsChange}
                  vehiculos={vehiculosPropios}
                  alMenosUno={true}
                  onRefreshVehiculos={onRefreshVehiculosPropios}
                  refreshingVehiculos={refreshingFlota}
                  getToken={getToken}
                  tenantId={tenantId || undefined}
                  onVehiculoCreado={onVehiculoCreado}
                />
                {ayudaFlotaVehiculo && <p className="text-xs text-vialto-steel">{ayudaFlotaVehiculo}</p>}
              </>
            )}
          </div>
        }
      />

      {mostrarGananciaBrutaManual && (
        <ViajeGananciaBrutaManualFieldset
          draft={gananciaDraft}
          onPatch={onGananciaBrutaManualPatch}
          labelClassName={fieldLabelClass}
          inputClassName={inputClass}
        />
      )}

      {mostrarPagosTransportista && (
        <div>
          <PagosTransportistaFieldset
            rows={pagosTransportista}
            onChange={onPagosTransportistaChange}
            saldoContext={{
              transportistaId,
              precioTransportistaExterno,
              monedaPrecioTransportistaExterno: monedaPrecioTransportista,
            }}
          />
          <button
            type="button"
            onClick={() =>
              onPagosTransportistaChange([...pagosTransportista, emptyPagoTransportista(monedaPrecioTransportista)])
            }
            className="mt-2 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
          >
            + Agregar pago al transportista
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="pt-2 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onVolver}>
          Volver
        </Button>
        <Button type="button" onClick={onContinuar}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
