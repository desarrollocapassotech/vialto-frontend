import type { CSSProperties } from 'react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buscarCiudades, normalizarEtiquetaCiudad, type PaisCodigo } from '@/lib/ciudades';
import { useDireccionesSugeridas } from '@/hooks/useDireccionesSugeridas';

/** Sin acentos ni mayúsculas, para filtrar direcciones por lo que se escribe. */
function claveBusqueda(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const MAX_DIRECCIONES = 8;

type Props = {
  /** País cuyo buscador se usa (Argentina, Uruguay, …). */
  pais: PaisCodigo;
  /** Nombre legible del país, para armar el placeholder dinámicamente. */
  paisNombre?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  /**
   * Mitiga el autocompletado del navegador (p. ej. Chrome ignora `autoComplete="off"` en campos tipo dirección).
   * Usa nombre no semántico, atributos anti-extensiones y `readOnly` hasta el primer foco.
   */
  disableBrowserAutocomplete?: boolean;
  /** Marca borde rojo cuando el campo tiene error de validación. */
  error?: boolean;
  /**
   * false = texto libre, sin buscador ni lista (`Tenant.recomendacionCiudadesHabilitada`
   * apagado). Default true: hay que elegir una ciudad de la lista.
   */
  sugerencias?: boolean;
  /**
   * Qué se carga ("origen", "destino"), para el placeholder en modo texto libre:
   * "Escribí o elegí el origen" (o "Escribí el origen" si no hay direcciones de
   * entrega para elegir). Sin esto, el placeholder de siempre.
   */
  campo?: string;
};

const MIN_CHARS = 2;

/**
 * Campo de ciudad: buscador con lista (hay que elegir una opción) o, con
 * `sugerencias={false}`, texto libre. Separado en dos componentes para no
 * llamar hooks condicionalmente.
 */
export function CiudadCombobox({
  pais,
  paisNombre,
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = 'h-9 w-full border border-black/15 bg-white px-2 text-sm',
  disabled,
  id: idProp,
  'aria-label': ariaLabel,
  disableBrowserAutocomplete = false,
  error = false,
  sugerencias = true,
  campo,
}: Props) {
  const direcciones = useDireccionesSugeridas();
  const datalistId = useId();
  if (!sugerencias) {
    const placeholderLibre =
      placeholder ??
      (campo
        ? direcciones.length > 0
          ? `Escribí o elegí el ${campo}`
          : `Escribí el ${campo}`
        : 'Ciudad o localidad');
    // Texto libre: las direcciones de entrega (si hay) se sugieren con la lista nativa.
    return (
      <div className={className}>
        {direcciones.length > 0 && (
          <datalist id={datalistId}>
            {direcciones.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        )}
        <input
          id={idProp}
          type="text"
          autoComplete="off"
          list={direcciones.length > 0 ? datalistId : undefined}
          disabled={disabled}
          placeholder={placeholderLibre}
          aria-label={ariaLabel}
          aria-invalid={error || undefined}
          className={
            error
              ? `${inputClassName.replace(/\bborder-black\/\d+\b/g, '').replace(/\s+/g, ' ').trim()} border-red-400`
              : inputClassName
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const trimmed = e.target.value.trim();
            if (trimmed !== e.target.value) onChange(trimmed);
          }}
        />
      </div>
    );
  }
  return (
    <CiudadComboboxBuscador
      pais={pais}
      paisNombre={paisNombre}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      inputClassName={inputClassName}
      disabled={disabled}
      id={idProp}
      aria-label={ariaLabel}
      disableBrowserAutocomplete={disableBrowserAutocomplete}
      error={error}
      direcciones={direcciones}
    />
  );
}

function CiudadComboboxBuscador({
  pais,
  paisNombre,
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = 'h-9 w-full border border-black/15 bg-white px-2 text-sm',
  disabled,
  id: idProp,
  'aria-label': ariaLabel,
  disableBrowserAutocomplete = false,
  error = false,
  direcciones = [],
}: Omit<Props, 'sugerencias'> & { direcciones?: string[] }) {
  const defaultPlaceholder = paisNombre
    ? `Buscá ciudad o localidad en ${paisNombre}…`
    : 'Buscá ciudad o localidad…';

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const inputId = idProp ?? `${reactId}-input`;
  const inputName = `vialto-ciudad-${reactId.replace(/:/g, '')}`;

  const [inputValue, setInputValue] = useState(value);
  const [browserAutofillLock, setBrowserAutofillLock] = useState(() => disableBrowserAutocomplete);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Direcciones de entrega de la empresa que coinciden con lo escrito (todas si el
  // campo está vacío). Van primero en la lista, antes de las ciudades.
  const direccionesMatch = useMemo(() => {
    if (direcciones.length === 0) return [];
    const q = claveBusqueda(inputValue);
    const lista = q ? direcciones.filter((d) => claveBusqueda(d).includes(q)) : direcciones;
    return lista.slice(0, MAX_DIRECCIONES).map((d) => ({ id: `dir:${d}`, label: d }));
  }, [direcciones, inputValue]);
  const opciones = useMemo(() => [...direccionesMatch, ...items], [direccionesMatch, items]);
  const hayQueMostrar =
    direccionesMatch.length > 0 || inputValue.trim().length >= MIN_CHARS || loading;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    setHighlight(0);
  }, [direccionesMatch.length]);

  useEffect(() => {
    if (!open || inputValue.trim().length < MIN_CHARS) {
      setItems([]);
      return;
    }

    const q = inputValue.trim();
    const t = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      buscarCiudades(pais, q, ac.signal)
        .then((rows) => {
          setItems(rows);
          setHighlight(0);
        })
        .catch(() => {
          if (ac.signal.aborted) return;
          setItems([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 320);

    return () => {
      window.clearTimeout(t);
    };
  }, [inputValue, open, pais]);

  function updateMenuPosition() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 220),
      zIndex: 9999,
    });
  }

  useLayoutEffect(() => {
    if (!open || !hayQueMostrar) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
  }, [open, items, loading, inputValue, hayQueMostrar]);

  useEffect(() => {
    if (!open) return;
    function onScrollResize() {
      updateMenuPosition();
    }
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(label: string) {
    const trimmed = label.trim();
    onChange(trimmed);
    setInputValue(trimmed);
    setOpen(false);
  }

  const showList = open && hayQueMostrar;
  const tituloSeccionClass =
    'px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-vialto-steel';
  const renderOpcion = (it: { id: string; label: string }, i: number) => (
    <li key={it.id} role="option" aria-selected={i === highlight}>
      <button
        type="button"
        className={`w-full px-3 py-2 text-left hover:bg-vialto-mist ${
          i === highlight ? 'bg-vialto-mist' : ''
        }`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pick(it.label)}
      >
        {it.label}
      </button>
    </li>
  );
  const buscaCiudades = inputValue.trim().length >= MIN_CHARS;
  const listEl =
    showList && menuStyle ? (
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        style={menuStyle}
        className="max-h-60 overflow-auto border border-black/15 bg-white py-1 text-sm shadow-md"
      >
        {direccionesMatch.length > 0 && (
          <>
            <li role="presentation" className={tituloSeccionClass}>
              Direcciones de entrega
            </li>
            {direccionesMatch.map((it, i) => renderOpcion(it, i))}
            {buscaCiudades && (
              <li role="presentation" className={`${tituloSeccionClass} border-t border-black/10`}>
                Ciudades
              </li>
            )}
          </>
        )}
        {loading && items.length === 0 && (
          <li className="px-3 py-2 text-vialto-steel">Buscando…</li>
        )}
        {!loading && opciones.length === 0 && buscaCiudades && (
          <li className="px-3 py-2 text-vialto-steel">Sin resultados. Elegí una opción de la lista.</li>
        )}
        {!loading && items.length === 0 && direccionesMatch.length > 0 && buscaCiudades && (
          <li className="px-3 py-2 text-xs text-vialto-steel">Sin ciudades que coincidan.</li>
        )}
        {items.map((it, i) => renderOpcion(it, direccionesMatch.length + i))}
      </ul>
    ) : null;

  const resolvedInputClass = error
    ? `${inputClassName.replace(/\bborder-black\/\d+\b/g, '').replace(/\s+/g, ' ').trim()} border-red-400`
    : inputClassName;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        id={inputId}
        name={disableBrowserAutocomplete ? inputName : undefined}
        type="text"
        autoComplete="off"
        disabled={disabled}
        readOnly={disableBrowserAutocomplete && !disabled && browserAutofillLock}
        data-lpignore={disableBrowserAutocomplete ? 'true' : undefined}
        data-1p-ignore={disableBrowserAutocomplete ? 'true' : undefined}
        placeholder={placeholder ?? defaultPlaceholder}
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        aria-expanded={open}
        aria-controls={showList ? listboxId : undefined}
        aria-autocomplete="list"
        role="combobox"
        className={resolvedInputClass}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => {
          if (browserAutofillLock) setBrowserAutofillLock(false);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            const trimmed = inputRef.current?.value.trim() ?? '';
            if (trimmed === '') {
              if (value !== '') onChange('');
              setInputValue('');
              return;
            }
            const v = value.trim();
            if (normalizarEtiquetaCiudad(trimmed) === normalizarEtiquetaCiudad(v)) {
              setInputValue(v);
              return;
            }
            setInputValue(value);
          }, 150);
        }}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === 'Escape') setOpen(false);
            return;
          }
          if (opciones.length === 0) {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter') e.preventDefault();
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => (h + 1) % opciones.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => (h - 1 + opciones.length) % opciones.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const elegida = opciones[highlight] ?? opciones[0];
            if (elegida) pick(elegida.label);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {typeof document !== 'undefined' && listEl ? createPortal(listEl, document.body) : null}
    </div>
  );
}
