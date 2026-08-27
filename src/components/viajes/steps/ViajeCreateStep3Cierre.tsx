import { Button } from "@/components/ui/Button";
import { CrudSubmitButton } from "@/components/crud/CrudSubmitButton";
import { ViajeFechaHoraFields } from "@/components/viajes/ViajeFechaHoraFields";
import {
  OtrosGastosFieldset,
  emptyOtroGasto,
  type OtroGastoDraft,
  type OtroGastoAutor,
} from "@/components/viajes/OtrosGastosFieldset";
const fieldLabelClass =
  "text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel";
const inputClass = "h-9 w-full border border-black/15 bg-white px-2 text-sm";
const textareaLongClass =
  "min-h-20 w-full border border-black/15 bg-white px-2 py-2 text-sm";

interface Props {
  labelIdentificacion: string;
  numeroIdentificacionPersonalizado: string;
  onNumeroIdentificacionChange: (v: string) => void;

  fechaCarga: string;
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
  onFechasPatch: (p: {
    fechaCarga?: string;
    horaCarga?: string;
    fechaDescarga?: string;
    horaDescarga?: string;
  }) => void;
  fechaCargaError: string | null;
  fechaDescargaError: string | null;

  mostrarKmLitros: boolean;
  mostrarKm: boolean;
  mostrarLitros: boolean;
  kmRecorridos: string;
  onKmRecorridosChange: (v: string) => void;
  litrosConsumidos: string;
  onLitrosConsumidosChange: (v: string) => void;

  mostrarDetalleCarga: boolean;
  detalleCarga: string;
  onDetalleCargaChange: (v: string) => void;
  mostrarObservaciones: boolean;
  observaciones: string;
  onObservacionesChange: (v: string) => void;

  mostrarOtrosGastos: boolean;
  otrosGastos: OtroGastoDraft[];
  onOtrosGastosChange: (rows: OtroGastoDraft[]) => void;
  gastoAutor?: OtroGastoAutor;
  tenantId?: string;

  error: string | null;
  loading: boolean;

  onVolver: () => void;
}

export function ViajeCreateStep3Cierre({
  labelIdentificacion,
  numeroIdentificacionPersonalizado,
  onNumeroIdentificacionChange,
  fechaCarga,
  horaCarga,
  fechaDescarga,
  horaDescarga,
  onFechasPatch,
  fechaCargaError,
  fechaDescargaError,
  mostrarKmLitros,
  mostrarKm,
  mostrarLitros,
  kmRecorridos,
  onKmRecorridosChange,
  litrosConsumidos,
  onLitrosConsumidosChange,
  mostrarDetalleCarga,
  detalleCarga,
  onDetalleCargaChange,
  mostrarObservaciones,
  observaciones,
  onObservacionesChange,
  mostrarOtrosGastos,
  otrosGastos,
  onOtrosGastosChange,
  gastoAutor,
  tenantId,
  error,
  loading,
  onVolver,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel/70">
          {labelIdentificacion}{" "}
        </span>
        <input
          type="text"
          value={numeroIdentificacionPersonalizado}
          onChange={(e) => onNumeroIdentificacionChange(e.target.value)}
          placeholder="Ej: CTG-01452301"
          className={inputClass}
        />
      </div>

      <ViajeFechaHoraFields
        fechaCarga={fechaCarga}
        horaCarga={horaCarga}
        fechaDescarga={fechaDescarga}
        horaDescarga={horaDescarga}
        onPatch={onFechasPatch}
        labelClassName={fieldLabelClass}
        inputClassName={inputClass}
        errorFechaCarga={fechaCargaError}
        errorFechaDescarga={fechaDescargaError}
      />

      {mostrarKmLitros && (mostrarKm || mostrarLitros) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mostrarKm && (
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Km recorridos</span>
              <input
                type="number"
                value={kmRecorridos}
                onChange={(e) => onKmRecorridosChange(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
          )}
          {mostrarLitros && (
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Litros consumidos</span>
              <input
                type="number"
                value={litrosConsumidos}
                onChange={(e) => onLitrosConsumidosChange(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}

      {mostrarDetalleCarga && (
        <div className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Detalle adicional</span>
          <textarea
            value={detalleCarga}
            onChange={(e) => onDetalleCargaChange(e.target.value)}
            placeholder="Notas extra: bultos, temperatura, precinto, etc."
            className={textareaLongClass}
          />
        </div>
      )}

      {mostrarObservaciones && (
        <div className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Observaciones</span>
          <textarea
            value={observaciones}
            onChange={(e) => onObservacionesChange(e.target.value)}
            placeholder="Notas adicionales"
            className={textareaLongClass}
          />
        </div>
      )}

      {mostrarOtrosGastos && (
        <div>
          <OtrosGastosFieldset
            rows={otrosGastos}
            onChange={onOtrosGastosChange}
            tenantId={tenantId}
            stacked
            mostrarCargadoPor={false}
          />
          <button
            type="button"
            onClick={() => onOtrosGastosChange([...otrosGastos, emptyOtroGasto(gastoAutor)])}
            className="mt-2 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
          >
            + Agregar gasto
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="pt-2 flex justify-end items-center gap-3">
        <Button type="button" variant="secondary" className="h-12" onClick={onVolver}>
          Volver
        </Button>
        <CrudSubmitButton loading={loading} label="Crear viaje" disableWhileLoading={false} className="h-12" />
      </div>
    </div>
  );
}
