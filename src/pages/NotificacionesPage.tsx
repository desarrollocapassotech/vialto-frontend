import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type { NotificacionFeed } from "@/types/notificaciones";

const LIMIT = 50;

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function NotificacionesPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [feed, setFeed] = useState<NotificacionFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await apiJson<NotificacionFeed>(
          `/api/notificaciones/feed?limit=${LIMIT}`,
          () => getToken(),
        );
        if (!cancelled) {
          setFeed(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "notificaciones"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Notificaciones
      </h1>
      <p className="mt-2 max-w-2xl text-vialto-steel">
        Últimos avisos enviados por email a los administradores de la cuenta.
      </p>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6">
        {loading && <p className="text-sm text-vialto-steel">Cargando…</p>}

        {!loading && feed && feed.items.length === 0 && !error && (
          <p className="text-sm text-vialto-steel">Todavía no hay notificaciones.</p>
        )}

        {!loading && feed && feed.items.length > 0 && (
          <div className="overflow-hidden border border-black/15">
            <table className="w-full text-sm">
              <tbody>
                {feed.items.map((item) => (
                  <tr key={item.id} className="border-t border-black/10 first:border-t-0">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-vialto-steel">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm text-vialto-charcoal">{item.titulo}</p>
                      <p className="mt-0.5 text-xs text-vialto-steel">{item.detalle}</p>
                    </td>
                    <td className="w-40 whitespace-nowrap px-4 py-3 text-right align-top text-xs text-vialto-steel">
                      {formatFecha(item.enviadoAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-6 text-sm text-vialto-steel">
        ¿Querés cambiar qué avisos recibís?{" "}
        <Link to="/configuracion/notificaciones" className="underline hover:text-vialto-charcoal">
          Ir a Ajustes de notificaciones
        </Link>
      </p>
    </div>
  );
}
