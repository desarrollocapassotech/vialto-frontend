import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";

const FORMULARIO_CANONICO = "alta_viaje";

type CampoConfig = {
  campo: string;
  label: string;
  obligatorioSistema: boolean;
  visible: boolean;
};

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

export function ConfiguracionCamposViajesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [campos, setCampos] = useState<CampoConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCampo, setSavingCampo] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await apiJson<CampoConfig[]>(
          `/api/field-config/viajes/${FORMULARIO_CANONICO}`,
          () => getToken(),
        );
        if (!cancelled) {
          setCampos(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "camposEmpresa"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  async function toggleCampo(campo: string, visibleActual: boolean) {
    setSavingCampo(campo);
    setError(null);
    const nuevoVisible = !visibleActual;
    try {
      await apiJson("/api/field-config/toggle", () => getToken(), {
        method: "POST",
        body: JSON.stringify({
          modulo: "viajes",
          formulario: FORMULARIO_CANONICO,
          campo,
          visible: nuevoVisible,
        }),
      });
      setCampos((prev) =>
        prev
          ? prev.map((c) =>
              c.campo === campo ? { ...c, visible: nuevoVisible } : c,
            )
          : prev,
      );
    } catch (e) {
      setError(friendlyError(e, "camposEmpresa"));
    } finally {
      setSavingCampo(null);
    }
  }

  // Los campos obligatorios del sistema no se pueden ocultar — no tiene
  // sentido mostrarlos acá, solo agregan ruido.
  const camposConfigurables = campos?.filter((c) => !c.obligatorioSistema) ?? null;

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Campos del módulo Viajes
      </h1>
      <p className="mt-2 max-w-3xl text-vialto-steel">
        Elegí qué campos opcionales se muestran en el alta, edición y detalle
        de un viaje. Los campos que ocultes dejan de aparecer en los
        formularios y en la vista de detalle para todos los usuarios de tu
        empresa — los datos que ya hayan cargado no se pierden.
      </p>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-hidden border border-black/15">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-vialto-mist text-left">
              <th className="px-4 py-2 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel">
                Campo
              </th>
              <th className="px-4 py-2 text-right font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel">
                Visible
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && camposConfigurables && camposConfigurables.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-vialto-steel">
                  No hay campos configurables.
                </td>
              </tr>
            )}
            {!loading &&
              camposConfigurables?.map((c) => (
                <tr key={c.campo} className="border-t border-black/10">
                  <td className="px-4 py-2.5">{c.label}</td>
                  <td className="px-4 py-2.5 text-right">
                    <ToggleSwitch
                      checked={c.visible}
                      disabled={savingCampo === c.campo}
                      onChange={() => toggleCampo(c.campo, c.visible)}
                      label={`${c.visible ? "Ocultar" : "Mostrar"} ${c.label}`}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
