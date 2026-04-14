import type { CSSProperties } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buscarCiudades, normalizarEtiquetaCiudad, type PaisCodigo } from '@/lib/ciudades';

type Props = {
  /** País cuyo buscador se usa (Argentina, Uruguay, …). */
  pais: PaisCodigo;
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
};

const MIN_CHARS = 2;

export function CiudadCombobox({
  pais,
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = 'h-9 w-full border border-black/15 bg-white px-2 text-sm',
  disabled,
  id: idProp,
  'aria-label': ariaLabel,
  disableBrowserAutocomplete = false,
}: Props) {
  const defaultPlaceholder =
    pais === 'UY' ? 'Buscá ciudad o localidad en Uruguay…' : 'Buscá ciudad o localidad en Argentina…';

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

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    if (!open || !(inputValue.trim().length >= MIN_CHARS || loading)) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
  }, [open, items, loading, inputValue]);

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

  const showList = open && (inputValue.trim().length >= MIN_CHARS || loading);
  const listEl =
    showList && menuStyle ? (
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        style={menuStyle}
        className="max-h-60 overflow-auto border border-black/15 bg-white py-1 text-sm shadow-md"
      >
        {loading && items.length === 0 && (
          <li className="px-3 py-2 text-vialto-steel">Buscando…</li>
        )}
        {!loading && items.length === 0 && inputValue.trim().length >= MIN_CHARS && (
          <li className="px-3 py-2 text-vialto-steel">Sin resultados. Elegí una opción de la lista.</li>
        )}
        {items.map((it, i) => (
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
        ))}
      </ul>
    ) : null;

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
        aria-expanded={open}
        aria-controls={showList ? listboxId : undefined}
        aria-autocomplete="list"
        role="combobox"
        className={inputClassName}
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
          if (items.length === 0) {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter') e.preventDefault();
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => (h + 1) % items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => (h - 1 + items.length) % items.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(items[highlight].label);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {typeof document !== 'undefined' && listEl ? createPortal(listEl, document.body) : null}
    </div>
  );
}
