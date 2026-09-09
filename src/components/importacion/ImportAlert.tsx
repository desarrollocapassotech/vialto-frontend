import React from "react";

interface ImportAlertProps {
  color: "red" | "amber" | "blue" | "gray";
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  open?: boolean;
  collapsible?: boolean;
  action?: React.ReactNode;
}

export function ImportAlert({
  color,
  title,
  subtitle,
  children,
  open = false,
  collapsible = true,
  action,
}: ImportAlertProps) {
  const colorStyles = {
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-100 bg-amber-50 text-amber-900",
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    gray: "border-gray-200 bg-gray-50 text-gray-800",
  };

  const containerClass = `group border px-3 py-2.5 text-xs ${colorStyles[color]}`;

  if (!collapsible) {
    return (
      <div className={`${containerClass} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <span className="font-medium">{title}</span>{" "}
          {subtitle && <span className="opacity-70">{subtitle}</span>}
          {children && <div className="mt-1.5 leading-relaxed">{children}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }

  return (
    <details className={containerClass} open={open}>
      <summary className="cursor-pointer list-none marker:hidden flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-medium">{title}</span>{" "}
          {subtitle && <span className="opacity-70">{subtitle}</span>}
          <span className="ml-1 inline-block transition-transform group-open:rotate-180">
            ▾
          </span>
        </div>
        {action && <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{action}</div>}
      </summary>
      {children && <div className="mt-1.5 leading-relaxed">{children}</div>}
    </details>
  );
}
