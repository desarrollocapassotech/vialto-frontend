import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ChevronDown } from "lucide-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type { NotificacionConfigEfectiva } from "@/types/notificaciones";
import type { PlatformUser } from "@/types/api";

type TenantUser = Pick<PlatformUser, "userId" | "firstName" | "lastName" | "email" | "role">;

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

function formatRole(role: string) {
  if (role === "org:admin") return "Administrador";
  if (role === "org:stock_viewer") return "Consulta de stock";
  if (role === "org:stock_operator") return "Operador de stock";
  return "Miembro";
}

function nombreUsuario(u: TenantUser) {
  const nombre = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return nombre || u.email || "Usuario sin nombre";
}

function DestinatariosPicker({
  destinatarios,
  usuarios,
  disabled,
  onChange,
}: {
  destinatarios: string[];
  usuarios: TenantUser[];
  disabled: boolean;
  onChange: (nuevos: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const resumen =
    destinatarios.length === 0
      ? "Todos los administradores"
      : `${destinatarios.length} usuario${destinatarios.length === 1 ? "" : "s"} elegido${destinatarios.length === 1 ? "" : "s"}`;

  function toggleUsuario(userId: string) {
    const nuevos = destinatarios.includes(userId)
      ? destinatarios.filter((id) => id !== userId)
      : [...destinatarios, userId];
    onChange(nuevos);
  }

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded border border-black/15 bg-white px-2.5 py-1.5 text-xs text-vialto-steel transition-colors hover:border-black/25 hover:text-vialto-charcoal disabled:opacity-50"
      >
        {resumen}
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-64 max-w-[80vw] overflow-hidden rounded-md border border-black/10 bg-white shadow-lg">
          <div className="max-h-56 overflow-y-auto py-1">
            {usuarios.length === 0 ? (
              <p className="px-3 py-2 text-xs text-vialto-steel">
                No hay usuarios en esta empresa.
              </p>
            ) : (
              usuarios.map((u) => {
                if (!u.userId) return null;
                const checked = destinatarios.includes(u.userId);
                return (
                  <label
                    key={u.userId}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-vialto-mist"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUsuario(u.userId as string)}
                      className="h-3.5 w-3.5 shrink-0 accent-vialto-charcoal"
                    />
                    <span className="min-w-0 flex-1 truncate text-vialto-charcoal">
                      {nombreUsuario(u)}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-vialto-steel">
                      {formatRole(u.role)}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="border-t border-black/10 px-3 py-2 text-[11px] leading-snug text-vialto-steel">
            Sin selección: se manda a todos los administradores.
          </div>
        </div>
      )}
    </div>
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
  const [usuarios, setUsuarios] = useState<TenantUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTipo, setSavingTipo] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [config, users] = await Promise.all([
          apiJson<NotificacionConfigEfectiva[]>("/api/notificaciones/config", () => getToken()),
          apiJson<TenantUser[]>("/api/users", () => getToken()),
        ]);
        if (!cancelled) {
          setItems(config);
          setUsuarios(users);
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

  async function actualizarDestinatarios(tipo: string, destinatarios: string[]) {
    setSavingTipo(tipo);
    setError(null);
    try {
      await apiJson("/api/notificaciones/config/destinatarios", () => getToken(), {
        method: "POST",
        body: JSON.stringify({ tipo, destinatarios }),
      });
      setItems((prev) =>
        prev ? prev.map((i) => (i.tipo === tipo ? { ...i, destinatarios } : i)) : prev,
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
              <div className="mt-2 overflow-visible border border-black/15">
                <table className="w-full text-sm">
                  <tbody>
                    {grupo.items.map((item) => (
                      <tr key={item.tipo} className="border-t border-black/10 first:border-t-0">
                        <td className="px-4 py-3">
                          <p className="text-sm text-vialto-charcoal">{item.label}</p>
                          <p className="mt-0.5 text-xs text-vialto-steel">{item.descripcion}</p>
                          {item.activo && (
                            <div className="mt-2">
                              <DestinatariosPicker
                                destinatarios={item.destinatarios}
                                usuarios={usuarios}
                                disabled={savingTipo === item.tipo}
                                onChange={(nuevos) => actualizarDestinatarios(item.tipo, nuevos)}
                              />
                            </div>
                          )}
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
