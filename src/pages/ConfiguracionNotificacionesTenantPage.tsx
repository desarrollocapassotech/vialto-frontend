import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type { NotificacionConfigEfectiva } from "@/types/notificaciones";

/** Mismo look & feel que el resto de las pantallas de configuración: charcoal = activo, rojo = apagado. */
function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      aria-pressed={checked}
      aria-label={label}
      className={[
        "inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-vialto-charcoal" : "bg-red-500",
      ].join(" ")}
    >
      <span
        className={[
          "h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

function agruparPorModulo(
  items: NotificacionConfigEfectiva[],
): { modulo: string; items: NotificacionConfigEfectiva[] }[] {
  const grupos = new Map<string, NotificacionConfigEfectiva[]>();
  for (const item of items) {
    const lista = grupos.get(item.modulo) ?? [];
    lista.push(item);
    grupos.set(item.modulo, lista);
  }
  return [...grupos.entries()].map(([modulo, items]) => ({ modulo, items }));
}

const MODULO_LABEL: Record<string, string> = {
  facturacion: "Facturación",
  combustible: "Combustible",
};

export function ConfiguracionNotificacionesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [items, setItems] = useState<NotificacionConfigEfectiva[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTipo, setSavingTipo] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await apiJson<NotificacionConfigEfectiva[]>(
          "/api/notificaciones/config",
          () => getToken(),
        );
        if (!cancelled) {
          setItems(data);
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

  async function toggle(tipo: string, activoActual: boolean) {
    setSavingTipo(tipo);
    setError(null);
    const nuevoActivo = !activoActual;
    try {
      await apiJson("/api/notificaciones/config/toggle", () => getToken(), {
        method: "POST",
        body: JSON.stringify({ tipo, activo: nuevoActivo }),
      });
      setItems((prev) =>
        prev
          ? prev.map((i) => (i.tipo === tipo ? { ...i, activo: nuevoActivo } : i))
          : prev,
      );
    } catch (e) {
      setError(friendlyError(e, "notificaciones"));
    } finally {
      setSavingTipo(null);
    }
  }

  const grupos = items ? agruparPorModulo(items) : [];

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Notificaciones por email
      </h1>
      <p className="mt-2 max-w-2xl text-vialto-steel">
        Elegí qué avisos querés recibir por email. Los mandamos a los
        administradores de la cuenta cuando hay algo nuevo para revisar.
      </p>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-8">
        {loading && (
          <p className="text-sm text-vialto-steel">Cargando…</p>
        )}

        {!loading && grupos.length === 0 && !error && (
          <p className="text-sm text-vialto-steel">
            Tu empresa todavía no tiene módulos con notificaciones disponibles.
          </p>
        )}

        {!loading &&
          grupos.map((grupo) => (
            <section key={grupo.modulo}>
              <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel">
                {MODULO_LABEL[grupo.modulo] ?? grupo.modulo}
              </h2>
              <div className="mt-2 overflow-hidden border border-black/15">
                <table className="w-full text-sm">
                  <tbody>
                    {grupo.items.map((item) => (
                      <tr key={item.tipo} className="border-t border-black/10 first:border-t-0">
                        <td className="px-4 py-3">
                          <p className="text-sm text-vialto-charcoal">{item.label}</p>
                          <p className="mt-0.5 text-xs text-vialto-steel">{item.descripcion}</p>
                        </td>
                        <td className="w-16 px-4 py-3 text-right align-top">
                          <ToggleSwitch
                            checked={item.activo}
                            disabled={savingTipo === item.tipo}
                            onChange={() => toggle(item.tipo, item.activo)}
                            label={`${item.activo ? "Desactivar" : "Activar"} ${item.label}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
