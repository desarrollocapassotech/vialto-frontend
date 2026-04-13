import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SearchableEntitySelectProps<T extends { id: string }> = {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  /** Filtrado local (nombre, códigos, etc.). */
  filterItems: (items: T[], query: string) => T[];
  getPrimaryLabel: (item: T) => string;
  getSecondaryLabel?: (item: T) => string | null | undefined;
  getItemId?: (item: T) => string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  placeholderCerrado?: string;
  placeholderBuscar?: string;
  /** Contenido cuando `items.length === 0` (ej. «Sin choferes…»). */
  noItemsSlot?: ReactNode;
  /** Permite `value === ''` y una fila inicial en el panel para volver a vacío. */
  allowEmptyValue?: boolean;
  /** Texto de la opción vacía dentro del panel (solo si `allowEmptyValue`). */
  emptyListChoiceLabel?: string;
  searchAriaLabel?: string;
  id?: string;
  'aria-label'?: string;
};

export function SearchableEntitySelect<T extends { id: string }>({
  items,
  value,
  onChange,
  filterItems,
  getPrimaryLabel,
  getSecondaryLabel,
  getItemId = (x) => x.id,
  disabled,
  className = '',
  inputClassName = 'h-9 w-full border border-black/15 bg-white px-2 text-sm',
  placeholderCerrado = 'Elegí…',
  placeholderBuscar = 'Buscar…',
  noItemsSlot,
  allowEmptyValue = false,
  emptyListChoiceLabel = 'Sin selección',
  searchAriaLabel = 'Filtrar lista',
  id: idProp,
  'aria-label': ariaLabel,
}: SearchableEntitySelectProps<T>) {
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const searchId = `${reactId}-search`;
  const triggerId = idProp ?? `${reactId}-trigger`;

  const selected = useMemo(
    () => items.find((x) => getItemId(x) === value) ?? null,
    [items, value, getItemId],
  );

  const displayLabel =
    value === '' && allowEmptyValue
      ? ''
      : selected
        ? getPrimaryLabel(selected)
        : '';

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => filterItems(items, filter), [items, filter, filterItems]);

  type Row = { kind: 'empty' } | { kind: 'item'; item: T };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (allowEmptyValue && !filter.trim()) {
      out.push({ kind: 'empty' });
    }
    for (const item of filtered) {
      out.push({ kind: 'item', item });
    }
    return out;
  }, [filtered, allowEmptyValue, filter]);

  function updateMenuPosition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 260),
      zIndex: 9999,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
  }, [open, rows.length, filter]);

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
    if (!open) return;
    setFilter('');
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [filter, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pickRow(i: number) {
    const r = rows[i];
    if (!r) return;
    if (r.kind === 'empty') {
      onChange('');
    } else {
      onChange(getItemId(r.item));
    }
    setOpen(false);
  }

  function handleOptionKeyDown(e: KeyboardEvent, i: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(i + 1, rows.length - 1);
      setHighlight(next);
      focusOptionIndex(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i <= 0) {
        searchInputRef.current?.focus();
        setHighlight(0);
      } else {
        const prev = i - 1;
        setHighlight(prev);
        focusOptionIndex(prev);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pickRow(i);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const canOpenPanel = items.length > 0 || allowEmptyValue;
  const showPanel = open && menuStyle && canOpenPanel;

  function focusOptionIndex(i: number) {
    const root = listRef.current;
    if (!root) return;
    const buttons = root.querySelectorAll<HTMLButtonElement>('button[type="button"]');
    buttons[i]?.focus();
  }

  const panelEl =
    showPanel && menuStyle ? (
      <div
        ref={panelRef}
        style={menuStyle}
        className="flex max-h-72 flex-col overflow-hidden border border-black/15 bg-white text-sm shadow-md"
      >
        <div className="shrink-0 border-b border-black/10 p-2">
          <input
            ref={searchInputRef}
            id={searchId}
            type="text"
            autoComplete="off"
            placeholder={placeholderBuscar}
            aria-label={searchAriaLabel}
            className="h-8 w-full border border-black/15 bg-white px-2 text-sm outline-none focus:border-black/25"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
                return;
              }
              if (e.key === 'ArrowDown' && rows.length > 0) {
                e.preventDefault();
                setHighlight(0);
                window.setTimeout(() => focusOptionIndex(0), 0);
              }
            }}
          />
        </div>
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className="min-h-0 flex-1 overflow-y-auto py-1"
        >
          {rows.length === 0 ? (
            <li className="px-3 py-2 text-vialto-steel">Sin coincidencias.</li>
          ) : (
            rows.map((row, i) => {
              if (row.kind === 'empty') {
                return (
                  <li key="__empty__" role="option" aria-selected={i === highlight}>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`w-full px-3 py-2 text-left text-vialto-steel hover:bg-vialto-mist focus:bg-vialto-mist focus:outline-none ${
                        i === highlight ? 'bg-vialto-mist' : ''
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickRow(i)}
                      onKeyDown={(e) => handleOptionKeyDown(e, i)}
                    >
                      {emptyListChoiceLabel}
                    </button>
                  </li>
                );
              }
              const c = row.item;
              const id = getItemId(c);
              const sec = getSecondaryLabel?.(c);
              return (
                <li key={id} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`w-full px-3 py-2 text-left hover:bg-vialto-mist focus:bg-vialto-mist focus:outline-none ${
                      i === highlight ? 'bg-vialto-mist' : ''
                    } ${id === value ? 'font-medium' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickRow(i)}
                    onKeyDown={(e) => handleOptionKeyDown(e, i)}
                  >
                    <span className="block truncate">{getPrimaryLabel(c)}</span>
                    {sec ? (
                      <span className="block truncate text-xs text-vialto-steel">{sec}</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    ) : null;

  if (items.length === 0 && !allowEmptyValue) {
    return (
      <div className={className}>
        {noItemsSlot ?? (
          <div className={`${inputClassName} flex items-center text-vialto-steel`} aria-label={ariaLabel}>
            Sin opciones
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={showPanel ? listboxId : undefined}
        className={`${inputClassName} flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            setOpen(false);
            return;
          }
          if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            !displayLabel && (value === '' || !selected) ? 'text-vialto-steel' : ''
          }`}
        >
          {displayLabel || placeholderCerrado}
        </span>
        <span className="shrink-0 text-vialto-steel/80" aria-hidden>
          ▾
        </span>
      </button>
      {typeof document !== 'undefined' && panelEl ? createPortal(panelEl, document.body) : null}
    </div>
  );
}
