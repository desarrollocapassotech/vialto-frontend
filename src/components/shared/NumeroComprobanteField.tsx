import { useEffect, useState, type ReactNode } from 'react';
import { apiJson } from '@/lib/api';
import { conBordeError } from '@/lib/bordeError';

type Props = {
  id: string;
  /** Contenido del label (con el asterisco si es obligatorio). */
  label: ReactNode;
  labelClassName: string;
  inputClassName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  /** Borde rojo (falta completar). No aplica con "Comprobante interno". */
  error?: boolean;
  automatico: boolean;
  onAutomaticoChange: (automatico: boolean) => void;
  /** Endpoint de vista previa del próximo número interno (`URL_NUMERO_INTERNO`). */
  urlNumeroInterno: string;
  getToken: () => Promise<string | null>;
};

/**
 * Número de comprobante con el tilde "Comprobante interno": en vez de tipearlo, el backend
 * asigna el próximo número interno al guardar. Acá se muestra cuál va a ser (vista previa: si
 * otro usuario guarda antes, puede tocar el siguiente).
 */
export function NumeroComprobanteField({
  id,
  label,
  labelClassName,
  inputClassName,
  value,
  onChange,
  placeholder,
  maxLength = 64,
  disabled,
  error,
  automatico,
  onAutomaticoChange,
  urlNumeroInterno,
  getToken,
}: Props) {
  const [previo, setPrevio] = useState<string | null>(null);
  const [falloPrevio, setFalloPrevio] = useState(false);
  /** Con el tilde, el número lo genera el sistema: se muestra cuál va a ser. */
  const urlVistaPrevia = automatico ? urlNumeroInterno : undefined;

  useEffect(() => {
    if (!urlVistaPrevia) return;
    let vigente = true;
    setPrevio(null);
    setFalloPrevio(false);
    apiJson<{ numero: string }>(urlVistaPrevia, getToken)
      .then((r) => vigente && setPrevio(r.numero))
      .catch(() => vigente && setFalloPrevio(true));
    return () => {
      vigente = false;
    };
    // getToken cambia de referencia en cada render en algunos hosts: solo se pide al cambiar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlVistaPrevia]);

  const valorAuto = previo ?? (falloPrevio ? 'Se asigna al guardar' : 'Calculando…');

  return (
    <div className="flex flex-col">
      {/* Label e input igual que los campos de al lado (quedan alineados); el tilde va abajo. */}
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      {urlVistaPrevia ? (
        <input
          id={id}
          type="text"
          readOnly
          tabIndex={-1}
          value={valorAuto}
          title="Numeración interna"
          className={`${inputClassName} cursor-default border-dashed bg-vialto-mist/60 tabular-nums text-vialto-steel`}
        />
      ) : (
        <input
          id={id}
          type="text"
          maxLength={maxLength}
          className={conBordeError(inputClassName, error)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
      <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 self-start text-[11px] text-vialto-steel">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 border-black/20"
          checked={automatico}
          disabled={disabled}
          onChange={(e) => onAutomaticoChange(e.target.checked)}
        />
        Comprobante interno
      </label>
    </div>
  );
}
