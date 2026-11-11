import type { ReactNode } from 'react';

interface CrudPageLayoutProps {
  title: string;
  error?: string | null;
  children: ReactNode;
  /** Clases del contenedor raíz. Default: ancho fijo sin centrar (comportamiento histórico). */
  contentClassName?: string;
  /**
   * Contenido centrado en la misma línea del título (ej. pasos de un asistente), para
   * no gastar una fila aparte. En mobile va abajo del título, también centrado.
   */
  headerCenter?: ReactNode;
}

export function CrudPageLayout({
  title,
  error,
  children,
  contentClassName = "max-w-4xl w-full min-w-0",
  headerCenter,
}: CrudPageLayoutProps) {
  const h1 = (
    <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
      {title}
    </h1>
  );
  return (
    <div className={contentClassName}>
      {headerCenter ? (
        // 3 columnas (título | centro | vacía del mismo ancho) para que el centro
        // quede centrado en la página y no en el espacio que sobra al lado del título.
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          {h1}
          <div className="flex justify-center">{headerCenter}</div>
          <div aria-hidden className="hidden lg:block" />
        </div>
      ) : (
        h1
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
