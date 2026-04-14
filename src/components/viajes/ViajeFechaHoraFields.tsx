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
}) {
  const subLabel = `${labelClassName} block min-h-[1.25rem] leading-tight`;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:items-start">
      <div className="flex min-w-0 flex-col gap-1">
        <span className={subLabel}>{labelFecha}</span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => onFecha(e.target.value)}
          className={inputClassName}
          aria-label={ariaFecha}
        />
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
        })}
      </div>
    </div>
  );
}
