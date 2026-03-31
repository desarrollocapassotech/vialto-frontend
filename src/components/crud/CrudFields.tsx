import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';

const baseClassName = 'h-10 border border-black/15 bg-white px-3 text-sm';

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
