type Patch = Partial<{
  fechaCarga: string;
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
}>;

type Props = {
  fechaCarga: string;
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
  onPatch: (p: Patch) => void;
  labelClassName: string;
  inputClassName: string;
  /**
   * `cargaOnly`: solo carga (legado).
   * `tablaCargaDescarga`: carga + descarga apilados para celda de tabla.
   */
  mode?: 'both' | 'cargaOnly' | 'tablaCargaDescarga';
  errorFechaCarga?: string | null;
  errorFechaDescarga?: string | null;
};

/** Misma altura de línea para sub-etiquetas (fecha / hora) y alinear inputs abajo. */
function campoFechaHora({
  labelFecha,
  labelHora,
  fecha,
  hora,
  onFecha,
  onHora,
  labelClassName,
  inputClassName,
  ariaFecha,
  ariaHora,
  errorFecha,
}: {
  labelFecha: string;
  labelHora: string;
  fecha: string;
  hora: string;
  onFecha: (v: string) => void;
  onHora: (v: string) => void;
  labelClassName: string;
  inputClassName: string;
  ariaFecha: string;
  ariaHora: string;
  errorFecha?: string | null;
}) {
  const subLabel = `${labelClassName} block min-h-[1.25rem] leading-tight`;
  const inputCls = `${inputClassName}${errorFecha ? ' border-red-400' : ''}`;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:items-start">
      <div className="flex min-w-0 flex-col gap-1">
        <span className={subLabel}>
          {labelFecha} <span className="text-red-500">*</span>
        </span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => onFecha(e.target.value)}
          className={inputCls}
          aria-label={ariaFecha}
          required
        />
        {errorFecha && (
          <span className="text-xs text-red-600">{errorFecha}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className={subLabel}>{labelHora}</span>
        <input
          type="time"
          value={hora}
          onChange={(e) => onHora(e.target.value)}
          className={inputClassName}
          aria-label={ariaHora}
        />
      </div>
    </div>
  );
}

export function ViajeFechaHoraFields({
  fechaCarga,
  horaCarga,
  fechaDescarga,
  horaDescarga,
  onPatch,
  labelClassName,
  inputClassName,
  mode = 'both',
  errorFechaCarga,
  errorFechaDescarga,
}: Props) {
  const tituloSeccion =
    'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';

  if (mode === 'cargaOnly') {
    return (
      <div className="min-w-[10rem]">
        {campoFechaHora({
          labelFecha: 'Fecha',
          labelHora: 'Hora (opcional)',
          fecha: fechaCarga,
          hora: horaCarga,
          onFecha: (v) => onPatch({ fechaCarga: v }),
          onHora: (v) => onPatch({ horaCarga: v }),
          labelClassName,
          inputClassName,
          ariaFecha: 'Fecha de carga',
          ariaHora: 'Hora de carga',
          errorFecha: errorFechaCarga,
        })}
      </div>
    );
  }

  if (mode === 'tablaCargaDescarga') {
    return (
      <div className="flex min-w-0 flex-col gap-3 min-w-[10rem]">
        <div className="flex min-w-0 flex-col gap-2">
          <span className={tituloSeccion}>Carga</span>
          {campoFechaHora({
            labelFecha: 'Fecha',
            labelHora: 'Hora (opcional)',
            fecha: fechaCarga,
            hora: horaCarga,
            onFecha: (v) => onPatch({ fechaCarga: v }),
            onHora: (v) => onPatch({ horaCarga: v }),
            labelClassName,
            inputClassName,
            ariaFecha: 'Fecha de carga',
            ariaHora: 'Hora de carga',
            errorFecha: errorFechaCarga,
          })}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className={tituloSeccion}>Descarga</span>
          {campoFechaHora({
            labelFecha: 'Fecha',
            labelHora: 'Hora (opcional)',
            fecha: fechaDescarga,
            hora: horaDescarga,
            onFecha: (v) => onPatch({ fechaDescarga: v }),
            onHora: (v) => onPatch({ horaDescarga: v }),
            labelClassName,
            inputClassName,
            ariaFecha: 'Fecha de descarga',
            ariaHora: 'Hora de descarga',
            errorFecha: errorFechaDescarga,
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
      <div className="flex min-w-0 flex-col gap-2">
        <span className={tituloSeccion}>Carga</span>
        {campoFechaHora({
          labelFecha: 'Fecha',
          labelHora: 'Hora (opcional)',
          fecha: fechaCarga,
          hora: horaCarga,
          onFecha: (v) => onPatch({ fechaCarga: v }),
          onHora: (v) => onPatch({ horaCarga: v }),
          labelClassName,
          inputClassName,
          ariaFecha: 'Fecha de carga',
          ariaHora: 'Hora de carga',
          errorFecha: errorFechaCarga,
        })}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <span className={tituloSeccion}>Descarga</span>
        {campoFechaHora({
          labelFecha: 'Fecha',
          labelHora: 'Hora (opcional)',
          fecha: fechaDescarga,
          hora: horaDescarga,
          onFecha: (v) => onPatch({ fechaDescarga: v }),
          onHora: (v) => onPatch({ horaDescarga: v }),
          labelClassName,
          inputClassName,
          ariaFecha: 'Fecha de descarga',
          ariaHora: 'Hora de descarga',
          errorFecha: errorFechaDescarga,
        })}
      </div>
    </div>
  );
}
