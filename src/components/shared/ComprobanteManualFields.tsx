import { crudFieldLabelClass } from "@/components/crud/CrudFields";
import {
  TIPOS_COMPROBANTE_MANUAL,
  type ComprobanteManualDraft,
  type ComprobanteManualErrores,
} from "@/lib/comprobanteManual";

const inputDefault = "h-10 w-full border border-black/15 bg-white px-3 text-sm";

/**
 * Tipo de comprobante + punto de venta + número (+ fecha, en liquidaciones) de un comprobante
 * cargado a mano en una empresa con ARCA. Todos obligatorios: con estos datos se arma el
 * número que se muestra ("A 0001-00000123") y el Libro IVA. Ver `lib/comprobanteManual.ts`.
 * Los estilos se toman del formulario que lo contiene.
 */
export function ComprobanteManualFields({
  value,
  onChange,
  errores = {},
  conFecha = false,
  fechaLabel = "Fecha de la factura",
  disabled,
  labelClassName = crudFieldLabelClass,
  inputClassName = inputDefault,
  className = "grid grid-cols-1 gap-3 sm:grid-cols-3",
}: {
  value: ComprobanteManualDraft;
  onChange: (value: ComprobanteManualDraft) => void;
  errores?: ComprobanteManualErrores;
  conFecha?: boolean;
  fechaLabel?: string;
  disabled?: boolean;
  labelClassName?: string;
  inputClassName?: string;
  className?: string;
}) {
  const patch = (p: Partial<ComprobanteManualDraft>) => onChange({ ...value, ...p });
  const claseInput = (campo: keyof ComprobanteManualDraft) =>
    errores[campo]
      ? `${inputClassName} border-red-400`.replace(/\bborder-black\/\d+\b/, "")
      : inputClassName;
  const soloDigitos = (texto: string) => texto.replace(/\D/g, "");

  return (
    <div className={conFecha ? `${className} sm:grid-cols-4` : className}>
      <label className="flex flex-col justify-end gap-1">
        <span className={labelClassName}>
          Tipo de comprobante <span className="text-red-500">*</span>
        </span>
        <select
          value={value.cbteTipo}
          onChange={(e) => patch({ cbteTipo: e.target.value })}
          disabled={disabled}
          className={claseInput("cbteTipo")}
        >
          <option value="">Elegí…</option>
          {TIPOS_COMPROBANTE_MANUAL.map((t) => (
            <option key={t.codigo} value={String(t.codigo)}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col justify-end gap-1">
        <span className={labelClassName}>
          Punto de venta <span className="text-red-500">*</span>
        </span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={value.ptoVenta}
          onChange={(e) => patch({ ptoVenta: soloDigitos(e.target.value) })}
          placeholder="0001"
          disabled={disabled}
          className={claseInput("ptoVenta")}
        />
      </label>
      <label className="flex flex-col justify-end gap-1">
        <span className={labelClassName}>
          Número <span className="text-red-500">*</span>
        </span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          value={value.cbteNro}
          onChange={(e) => patch({ cbteNro: soloDigitos(e.target.value) })}
          placeholder="00000123"
          disabled={disabled}
          className={claseInput("cbteNro")}
        />
      </label>
      {conFecha && (
        <label className="flex flex-col justify-end gap-1">
          <span className={labelClassName}>
            {fechaLabel} <span className="text-red-500">*</span>
          </span>
          <input
            type="date"
            value={value.fecha}
            onChange={(e) => patch({ fecha: e.target.value })}
            disabled={disabled}
            className={claseInput("fecha")}
          />
        </label>
      )}
    </div>
  );
}
