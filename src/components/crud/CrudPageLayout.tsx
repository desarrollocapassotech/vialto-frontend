import type { ReactNode } from 'react';

interface CrudPageLayoutProps {
  title: string;
  error?: string | null;
  children: ReactNode;
}

export function CrudPageLayout({
  title,
  error,
  children,
}: CrudPageLayoutProps) {
  return (
    <div className="max-w-4xl w-full min-w-0">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
        {title}
      </h1>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
