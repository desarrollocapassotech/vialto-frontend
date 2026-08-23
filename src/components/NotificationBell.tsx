import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Bell } from "lucide-react";
import { apiJson } from "@/lib/api";
import type { NotificacionFeed } from "@/types/notificaciones";

const DROPDOWN_LIMIT = 3;
const FETCH_LIMIT = DROPDOWN_LIMIT + 1; // uno de más solo para saber si "ver todas" tiene sentido
const POLL_MS = 60_000;

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  return `hace ${dias} d`;
}

export function NotificationBell() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<NotificacionFeed | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const data = await apiJson<NotificacionFeed>(
        `/api/notificaciones/feed?limit=${FETCH_LIMIT}`,
        () => getToken(),
      );
      setFeed(data);
    } catch {
      // silencioso: si falla, la campana simplemente no muestra novedades hasta el próximo poll
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchFeed();
    const id = setInterval(fetchFeed, POLL_MS);
    return () => clearInterval(id);
  }, [fetchFeed]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && feed && feed.noLeidas > 0) {
      setFeed((prev) => (prev ? { ...prev, noLeidas: 0 } : prev));
      try {
        await apiJson("/api/notificaciones/feed/marcar-leidas", () => getToken(), {
          method: "POST",
          body: JSON.stringify({}),
        });
      } catch {
        // si falla, el próximo poll vuelve a traer el contador real
      }
    }
  }

  const items = feed?.items.slice(0, DROPDOWN_LIMIT) ?? [];
  const hayMas = (feed?.items.length ?? 0) > DROPDOWN_LIMIT;
  const noLeidas = feed?.noLeidas ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notificaciones"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/85 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-vialto-fire px-1 text-[10px] font-semibold leading-none text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-md border border-black/10 bg-white text-vialto-charcoal shadow-lg">
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-vialto-steel">
                Sin notificaciones por ahora.
              </p>
            ) : (
              <ul className="divide-y divide-black/5">
                {items.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-vialto-charcoal">{item.titulo}</p>
                    <p className="mt-0.5 text-xs text-vialto-steel">{item.detalle}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-vialto-steel/70">
                      {formatRelative(item.enviadoAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hayMas && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/notificaciones");
              }}
              className="block w-full border-t border-black/10 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
            >
              Ver todas
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/configuracion/notificaciones");
            }}
            className="block w-full border-t border-black/10 px-4 py-2.5 text-center text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
          >
            Ajustes
          </button>
        </div>
      )}
    </div>
  );
}
