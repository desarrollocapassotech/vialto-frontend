import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { resolveBreadcrumbs, type Crumb } from "@/lib/breadcrumbs";

export function Breadcrumbs({
  override,
  superadmin,
  stockViewer,
}: {
  override: Crumb[] | null;
  superadmin: boolean;
  stockViewer: boolean;
}) {
  const location = useLocation();
  const crumbs =
    override ??
    resolveBreadcrumbs(location.pathname, new URLSearchParams(location.search), {
      superadmin,
      stockViewer,
    });

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Ruta de navegación" className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-vialto-steel/50"
                strokeWidth={2}
                aria-hidden
              />
            )}
            {!isLast && crumb.to ? (
              <Link to={crumb.to} className="text-vialto-fire hover:text-vialto-bright">
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-vialto-charcoal" : "text-vialto-steel"}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
