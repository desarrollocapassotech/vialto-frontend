import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const baseClassName = 'h-10 border border-black/15 bg-white px-3 text-sm';

export const crudFieldLabelClass =
  'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';

/** Etiqueta de campo CRUD; con `required` muestra asterisco rojo como en Nombre. */
export function CrudFieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className={crudFieldLabelClass}>
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </span>
  );
}

export function CrudInput({
  className,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const parts = [baseClassName, error ? 'border-red-400' : '', className].filter(Boolean);
  return <input className={parts.join(' ')} {...props} />;
}

export function CrudSelect({
  className,
  error,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  const parts = [baseClassName, error ? 'border-red-400' : '', className].filter(Boolean);
  return <select className={parts.join(' ')} {...props} />;
}
