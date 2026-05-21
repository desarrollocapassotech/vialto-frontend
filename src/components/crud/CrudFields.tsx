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

export function CrudInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const mergedClassName = className ? `${baseClassName} ${className}` : baseClassName;
  return <input className={mergedClassName} {...props} />;
}

export function CrudSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const mergedClassName = className ? `${baseClassName} ${className}` : baseClassName;
  return <select className={mergedClassName} {...props} />;
}
