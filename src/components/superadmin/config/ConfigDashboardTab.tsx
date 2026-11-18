import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { TenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import {
  TIPO_BLOQUE_LABEL,
  bloqueDashboard,
  bloquesDisponibles,
  bloquesEfectivos,
  usaBloquesRecomendados,
  type DashboardBloqueTipo,
} from "@/lib/dashboardBloques";
import type { Tenant } from "@/types/api";
import { ConfigFila, ConfigSeccion } from "./ConfigUi";
import { Switch } from "./ConfigGeneralTab";

type Props = { config: TenantConfigEmpresa & { tenant: Tenant } };

const botonIcono =
  "inline-flex h-7 w-7 items-center justify-center border border-black/15 bg-white text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal disabled:pointer-events-none disabled:opacity-30";

const TIPOS: DashboardBloqueTipo[] = ["tarjeta", "pendientes", "analisis"];

/**
 * Ficha de la empresa → Dashboard: si la empresa tiene dashboard y qué bloques ve, en
 * qué orden (`Tenant.dashboardBloques`). Cada cambio se guarda al tocar. Sin
 * configuración guardada la empresa ve el set recomendado para sus módulos.
 */
export function ConfigDashboardTab({ config }: Props) {
  const { tenant, guardar, estaGuardando } = config;
  const habilitado = tenant.dashboardHabilitado ?? true;
  const elegidos = bloquesEfectivos(tenant);
  const recomendado = usaBloquesRecomendados(tenant);
  const disponibles = bloquesDisponibles(tenant).filter((b) => !elegidos.includes(b.id));
  const guardando = estaGuardando("dashboardBloques");

  // Bloques guardados de módulos que la empresa ya no tiene: se conservan al final,
  // así vuelven a aparecer si se recontrata el módulo.
  const ocultos = (tenant.dashboardBloques ?? []).filter(
    (id) => !bloqueDashboard(id)?.disponible(tenant),
  );

  function guardarOrden(next: string[]) {
    void guardar({ dashboardBloques: [...next, ...ocultos] });
  }

  function mover(i: number, delta: -1 | 1) {
    const next = [...elegidos];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    guardarOrden(next);
  }

  return (
    <>
      <ConfigSeccion titulo="Inicio">
        <ConfigFila
          label="Dashboard (pantalla de inicio)"
          ayuda="Apagado: la empresa entra directo al primer módulo del menú."
        >
          <Switch config={config} campo="dashboardHabilitado" valorDefault label="dashboard" />
        </ConfigFila>
      </ConfigSeccion>

      {habilitado && (
        <>
          <ConfigSeccion
            titulo="Bloques que se ven"
            acciones={
              !recomendado && (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void guardar({ dashboardBloques: [] })}
                  className="text-xs text-vialto-steel underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Volver al recomendado
                </button>
              )
            }
            barra={
              <p className="text-xs text-vialto-steel">
                {recomendado
                  ? "Usa el set recomendado para sus módulos. Cualquier cambio lo vuelve propio de la empresa."
                  : "Configuración propia de la empresa. Se muestran en este orden; las tarjetas seguidas van en una misma fila."}
              </p>
            }
          >
            {elegidos.map((id, i) => {
              const b = bloqueDashboard(id);
              if (!b) return null;
              return (
                <ConfigFila
                  key={id}
                  label={`${i + 1}. ${b.label}`}
                  ayuda={`${b.ayuda} (${TIPO_BLOQUE_LABEL[b.tipo]} · ${b.modulo})`}
                  palabrasClave={`${b.modulo} ${TIPO_BLOQUE_LABEL[b.tipo]}`}
                >
                  <span className="text-xs text-vialto-steel">{TIPO_BLOQUE_LABEL[b.tipo]}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={botonIcono}
                      disabled={guardando || i === 0}
                      onClick={() => mover(i, -1)}
                      aria-label={`Subir ${b.label}`}
                      title="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={botonIcono}
                      disabled={guardando || i === elegidos.length - 1}
                      onClick={() => mover(i, 1)}
                      aria-label={`Bajar ${b.label}`}
                      title="Bajar"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={botonIcono}
                      disabled={guardando || elegidos.length === 1}
                      onClick={() => guardarOrden(elegidos.filter((x) => x !== id))}
                      aria-label={`Quitar ${b.label}`}
                      title={elegidos.length === 1 ? "Tiene que quedar al menos uno (para no mostrar nada, apagá el dashboard)" : "Quitar"}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </ConfigFila>
              );
            })}
            {elegidos.length === 0 && (
              <p className="px-4 py-3 text-sm text-vialto-steel">
                Ningún módulo contratado tiene bloques de dashboard.
              </p>
            )}
          </ConfigSeccion>

          {TIPOS.map((tipo) => {
            const deTipo = disponibles.filter((b) => b.tipo === tipo);
            if (deTipo.length === 0) return null;
            return (
              <ConfigSeccion key={tipo} titulo={`Agregar · ${TIPO_BLOQUE_LABEL[tipo]}`} columnas>
                {deTipo.map((b) => (
                  <ConfigFila
                    key={b.id}
                    label={b.label}
                    ayuda={`${b.ayuda} (${b.modulo})`}
                    palabrasClave={b.modulo}
                  >
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => guardarOrden([...elegidos, b.id])}
                      className="inline-flex items-center gap-1 border border-black/20 bg-white px-2.5 py-1 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Agregar
                    </button>
                  </ConfigFila>
                ))}
              </ConfigSeccion>
            );
          })}
        </>
      )}
    </>
  );
}
