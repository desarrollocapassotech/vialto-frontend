import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { PaisModal } from "@/components/viajes/PaisModal";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { canAccessMantenimiento } from "@/lib/tenantModules";
import { ordenarAlfabetico } from "@/lib/ordenAlfabetico";
import {
  CAMPOS_SWITCH_ENTIDAD,
  FORMULARIO_SWITCH_ENTIDAD,
  SWITCHES_ENTIDAD_VIAJES,
} from "@/lib/configEntidadesViajes";
import type { TenantConfigEmpresa } from "@/hooks/useTenantConfigEmpresa";
import type { Pais, Tenant, TipoFlota } from "@/types/api";
import {
  ConfigControl,
  ConfigFila,
  ConfigSeccion,
  ConfigTextoInput,
  ToggleSwitch,
  configSelectClass,
} from "./ConfigUi";

type Props = {
  orgId: string;
  config: TenantConfigEmpresa & { tenant: Tenant };
};

export function ConfigGeneralTab({ orgId, config }: Props) {
  const { tenant, guardar, estaGuardando } = config;
  const paisOculto = tenant.paisOrigenDestinoOculto ?? false;
  const tipoFlota = tenant.tipoFlota ?? "mixta";

  return (
    <>
      <ConfigSeccion titulo="Accesos">
        <ConfigFila
          label="Importación masiva de Excel"
          ayuda="Muestra la pantalla de importar Excel al admin de la empresa. El superadmin la ve siempre."
        >
          <ToggleSwitch
            checked={!tenant.importacionesOcultas}
            disabled={estaGuardando("importacionesOcultas")}
            onChange={() =>
              void guardar({
                importacionesOcultas: !tenant.importacionesOcultas,
              })
            }
            label={
              tenant.importacionesOcultas
                ? "Mostrar importación masiva"
                : "Ocultar importación masiva"
            }
          />
        </ConfigFila>
      </ConfigSeccion>

      <EntidadesViajesSeccion orgId={orgId} />

      <ConfigSeccion titulo="Flota">
        <ConfigFila
          label="Tipo de flota"
          ayuda="Define las opciones de pertenencia de Choferes y Vehículos, el tipo de flota al cargar un viaje y si se ve la pestaña Transportistas."
        >
          <ConfigControl>
            <select
              value={tipoFlota}
              disabled={estaGuardando("tipoFlota")}
              onChange={(e) =>
                void guardar({ tipoFlota: e.target.value as TipoFlota })
              }
              className={configSelectClass}
            >
              <option value="mixta">Propia y transportistas externos</option>
              <option value="propia">Solo flota propia</option>
              <option value="externa">Solo transportistas externos</option>
            </select>
          </ConfigControl>
        </ConfigFila>
        {tipoFlota === "mixta" && (
          <ConfigFila
            label="Flota por defecto al crear"
            ayuda="Opción marcada al crear un viaje, chofer o vehículo (se puede cambiar en cada alta). “Según el formulario”: viajes con transportista externo; choferes y vehículos con flota propia."
          >
            <ConfigControl>
              <select
                value={tenant.tipoFlotaDefault ?? ""}
                disabled={estaGuardando("tipoFlotaDefault")}
                onChange={(e) =>
                  void guardar({
                    tipoFlotaDefault: (e.target.value || null) as
                      "propia" | "externa" | null,
                  })
                }
                className={configSelectClass}
              >
                <option value="">Según el formulario</option>
                <option value="propia">Flota propia</option>
                <option value="externa">Transportista externo</option>
              </select>
            </ConfigControl>
          </ConfigFila>
        )}
      </ConfigSeccion>

      <ConfigSeccion titulo="Nombres">
        <LabelSingularPlural
          config={config}
          label="Producto"
          ayuda="Reemplaza a “Producto” en todo el sistema salvo Stock (Viajes, Base de datos, importación y PDFs). El plural se completa solo; corregilo si hace falta. Vacío = “Producto”."
          campoSingular="productoLabel"
          campoPlural="productoLabelPlural"
          placeholderSingular="Producto"
          placeholderPlural="Productos"
        />
        <LabelSingularPlural
          config={config}
          label="Transportista"
          ayuda="Cómo llama la empresa al transportista externo (ej. “Fletero”). Se usa en Base de datos, Viajes y Liquidaciones. El plural se completa solo; corregilo si hace falta. Vacío = “Transportista”."
          campoSingular="transportistaLabel"
          campoPlural="transportistaLabelPlural"
          placeholderSingular="Transportista"
          placeholderPlural="Transportistas"
        />
      </ConfigSeccion>

      <ConfigSeccion titulo="País y CUIT">
        <ConfigFila
          label="Selector de país"
          ayuda="En Viajes, Clientes y Transportistas. Apagado: se usa siempre el país fijo."
        >
          <ToggleSwitch
            checked={!paisOculto}
            disabled={estaGuardando("paisOrigenDestinoOculto")}
            onChange={() =>
              void guardar({ paisOrigenDestinoOculto: !paisOculto })
            }
            label={
              paisOculto
                ? "Mostrar selector de país"
                : "Ocultar selector de país"
            }
          />
        </ConfigFila>
        {paisOculto && <PaisFijoFila orgId={orgId} config={config} />}
        <ConfigFila
          label="Validar CUIT con ARCA"
          ayuda="En Clientes y Transportistas: consulta el CUIT argentino en ARCA y completa nombre, domicilio y condición IVA. No requiere el módulo ARCA."
          palabrasClave="padron afip"
        >
          <Switch
            config={config}
            campo="validacionCuitArcaHabilitada"
            label="validación de CUIT con ARCA"
          />
        </ConfigFila>
      </ConfigSeccion>

      <ConfigSeccion titulo="Otros módulos">
        <ConfigFila
          label="Marcar factura como cobrada"
          ayuda="Muestra en Facturas la acción “Marcar como cobrada”, que registra el pago del saldo pendiente."
          palabrasClave="facturas cobro"
        >
          <Switch
            config={config}
            campo="marcarCobradaHabilitada"
            label="marcar como cobrada"
          />
        </ConfigFila>
        {canAccessMantenimiento(tenant.modules) && (
          <ConfigFila
            label="Planes de mantenimiento"
            ayuda="Prendido: planes, vencimientos y avisos por mail. Apagado: Mantenimiento queda solo con órdenes de trabajo. Los planes cargados no se borran."
          >
            <Switch
              config={config}
              campo="mantenimientoPlanesHabilitados"
              valorDefault
              label="planes de mantenimiento"
            />
          </ConfigFila>
        )}
      </ConfigSeccion>
    </>
  );
}

type CampoBooleano = {
  [K in keyof Tenant]-?: NonNullable<Tenant[K]> extends boolean ? K : never;
}[keyof Tenant];

/** Switch de un flag booleano del Tenant. */
export function Switch({
  config,
  campo,
  valorDefault = false,
  label,
}: {
  config: TenantConfigEmpresa & { tenant: Tenant };
  campo: CampoBooleano;
  valorDefault?: boolean;
  label: string;
}) {
  const valor = (config.tenant[campo] as boolean | undefined) ?? valorDefault;
  return (
    <ToggleSwitch
      checked={valor}
      disabled={config.estaGuardando(campo)}
      onChange={() => void config.guardar({ [campo]: !valor })}
      label={`${valor ? "Deshabilitar" : "Habilitar"} ${label}`}
    />
  );
}

/** Nombre propio de una entidad: singular (el backend genera el plural con IA) + plural. */
function LabelSingularPlural({
  config,
  label,
  ayuda,
  campoSingular,
  campoPlural,
  placeholderSingular,
  placeholderPlural,
}: {
  config: TenantConfigEmpresa & { tenant: Tenant };
  label: string;
  ayuda: string;
  campoSingular: "productoLabel" | "transportistaLabel";
  campoPlural: "productoLabelPlural" | "transportistaLabelPlural";
  placeholderSingular: string;
  placeholderPlural: string;
}) {
  const { tenant, guardar, estaGuardando } = config;
  const singular = tenant[campoSingular] ?? "";
  const plural = tenant[campoPlural] ?? "";
  const saving = estaGuardando(campoSingular, campoPlural);
  return (
    <ConfigFila label={label} ayuda={ayuda} palabrasClave="label nombre plural">
      <div className="grid w-full grid-cols-2 gap-2 sm:w-80">
        <ConfigTextoInput
          valor={singular}
          onGuardar={(v) =>
            void guardar(
              { [campoSingular]: v || null },
              { mensaje: "Nombre actualizado", desdeRespuesta: [campoPlural] },
            )
          }
          disabled={saving}
          maxLength={40}
          placeholder={placeholderSingular}
          ariaLabel={`${label} en singular`}
        />
        <ConfigTextoInput
          valor={plural}
          onGuardar={(v) =>
            void guardar(
              { [campoPlural]: v || null },
              { mensaje: "Nombre actualizado" },
            )
          }
          disabled={saving || !singular}
          maxLength={40}
          placeholder={placeholderPlural}
          ariaLabel={`${label} en plural`}
        />
      </div>
    </ConfigFila>
  );
}

function PaisFijoFila({
  orgId,
  config,
}: {
  orgId: string;
  config: TenantConfigEmpresa & { tenant: Tenant };
}) {
  const { getToken } = useAuth();
  const [paises, setPaises] = useState<Pais[] | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const { tenant, guardar, estaGuardando } = config;

  useEffect(() => {
    let cancelled = false;
    setPaises(null);
    (async () => {
      try {
        const data = await apiJson<Pais[]>(
          `/api/platform/paises?tenantId=${encodeURIComponent(orgId)}`,
          () => getToken(),
        );
        if (!cancelled) setPaises(data);
      } catch {
        if (!cancelled) setPaises([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, orgId]);

  return (
    <ConfigFila
      label="País fijo"
      ayuda="País de origen/destino de Viajes y país fiscal de Clientes y Transportistas cuando el selector está apagado."
    >
      {paises === null ? (
        <span className="text-sm text-vialto-steel">Cargando…</span>
      ) : paises.length === 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-vialto-steel">Sin países cargados</span>
          <button
            type="button"
            onClick={() => setMostrarModal(true)}
            className="border border-black/20 bg-white px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-vialto-mist"
          >
            + Nuevo país
          </button>
        </div>
      ) : (
        <ConfigControl>
          <select
            value={tenant.paisOrigenDestinoFijoId ?? ""}
            disabled={estaGuardando("paisOrigenDestinoFijoId")}
            onChange={(e) =>
              void guardar({ paisOrigenDestinoFijoId: e.target.value || null })
            }
            className={configSelectClass}
          >
            <option value="">Sin elegir…</option>
            {ordenarAlfabetico(paises, (p) => p.nombre).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </ConfigControl>
      )}
      {mostrarModal && (
        <PaisModal
          getToken={getToken}
          tenantId={orgId}
          onClose={() => setMostrarModal(false)}
          onSaved={(p) => {
            setPaises((prev) => [...(prev ?? []), p]);
            setMostrarModal(false);
          }}
        />
      )}
    </ConfigFila>
  );
}

/** Choferes / Vehículos / Productos: visibilidad de campos de Viajes (field-config). */
function EntidadesViajesSeccion({ orgId }: { orgId: string }) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  // campo → visible
  const [visibles, setVisibles] = useState<Record<string, boolean> | null>(
    null,
  );
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVisibles(null);
    (async () => {
      try {
        const campos = await apiJson<{ campo: string; visible: boolean }[]>(
          `/api/platform/field-config/${encodeURIComponent(orgId)}?modulo=viajes&formulario=${FORMULARIO_SWITCH_ENTIDAD}`,
          () => getToken(),
        );
        if (!cancelled) {
          setVisibles(
            Object.fromEntries(
              [...CAMPOS_SWITCH_ENTIDAD].map((c) => [
                c,
                campos.find((x) => x.campo === c)?.visible ?? true,
              ]),
            ),
          );
        }
      } catch (e) {
        if (!cancelled) showToast(friendlyError(e, "camposEmpresa"), "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, orgId, showToast]);

  /** Prendido si al menos uno de sus campos está visible. */
  const habilitado = (campos: readonly string[]) =>
    campos.some((c) => visibles?.[c] ?? true);

  async function toggle(label: string, campos: readonly string[]) {
    const nuevo = !habilitado(campos);
    setGuardando(label);
    try {
      for (const campo of campos) {
        await apiJson(
          `/api/platform/field-config/${encodeURIComponent(orgId)}/toggle`,
          () => getToken(),
          {
            method: "POST",
            body: JSON.stringify({
              modulo: "viajes",
              formulario: FORMULARIO_SWITCH_ENTIDAD,
              campo,
              visible: nuevo,
              aplicarATodosLosFormularios: true,
            }),
          },
        );
        setVisibles((prev) => ({ ...prev, [campo]: nuevo }));
      }
      showToast("Cambios guardados", "success");
    } catch (e) {
      showToast(friendlyError(e, "camposEmpresa"), "error");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <ConfigSeccion titulo="Datos que usa la empresa">
      {SWITCHES_ENTIDAD_VIAJES.map((s) => {
        const on = habilitado(s.campos);
        return (
          <ConfigFila key={s.label} label={s.label} ayuda={s.ayuda}>
            <ToggleSwitch
              checked={on}
              disabled={visibles === null || guardando === s.label}
              onChange={() => void toggle(s.label, s.campos)}
              label={`${on ? "Deshabilitar" : "Habilitar"} ${s.label.toLowerCase()}`}
            />
          </ConfigFila>
        );
      })}
    </ConfigSeccion>
  );
}
