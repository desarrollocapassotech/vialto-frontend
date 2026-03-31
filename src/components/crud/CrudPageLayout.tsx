import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface CrudPageLayoutProps {
  title: string;
  backTo: string;
  backLabel: string;
  error?: string | null;
  children: ReactNode;
}

export function CrudPageLayout({
  title,
  backTo,
  backLabel,
  error,
  children,
}: CrudPageLayoutProps) {
  return (
    <div className="max-w-4xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        {title}
      </h1>
      <div className="mt-4">
        <Link className="text-sm text-vialto-fire hover:text-vialto-bright" to={backTo}>
          {backLabel}
        </Link>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
